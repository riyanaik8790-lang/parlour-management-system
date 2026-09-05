<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Method not allowed'], 405);
}

// ─── Brute-force protection ────────────────────────────────────────────────────
// Simple file-based rate limiter: max 5 failed attempts per IP per 15 minutes.
// Stored in the system temp dir so it works on any host without extra services.

define('LOGIN_MAX_ATTEMPTS', 5);
define('LOGIN_WINDOW_SECONDS', 15 * 60); // 15 minutes

function get_client_ip(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        $val = $_SERVER[$key] ?? '';
        if ($val !== '') {
            // X-Forwarded-For can be a comma-separated list; take the first entry
            return trim(explode(',', $val)[0]);
        }
    }
    return 'unknown';
}

function rate_limit_key(string $ip): string {
    // Store per-IP counters in the system temp dir
    $safe = preg_replace('/[^a-fA-F0-9:\.\-]/', '_', $ip);
    return sys_get_temp_dir() . '/salon_login_' . $safe . '.json';
}

function check_rate_limit(): void {
    $ip   = get_client_ip();
    $file = rate_limit_key($ip);
    $now  = time();

    $data = ['attempts' => 0, 'window_start' => $now];
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $data = $decoded;
        }
    }

    // Reset window if it has expired
    if ($now - $data['window_start'] >= LOGIN_WINDOW_SECONDS) {
        $data = ['attempts' => 0, 'window_start' => $now];
    }

    if ($data['attempts'] >= LOGIN_MAX_ATTEMPTS) {
        $retry_in = LOGIN_WINDOW_SECONDS - ($now - $data['window_start']);
        $minutes  = (int) ceil($retry_in / 60);
        json_out([
            'error' => "Too many failed attempts. Please try again in {$minutes} minute(s).",
        ], 429);
    }
}

function record_failed_attempt(): void {
    $ip   = get_client_ip();
    $file = rate_limit_key($ip);
    $now  = time();

    $data = ['attempts' => 0, 'window_start' => $now];
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $data = $decoded;
        }
    }

    if ($now - $data['window_start'] >= LOGIN_WINDOW_SECONDS) {
        $data = ['attempts' => 1, 'window_start' => $now];
    } else {
        $data['attempts']++;
    }

    @file_put_contents($file, json_encode($data), LOCK_EX);
}

function clear_failed_attempts(): void {
    $file = rate_limit_key(get_client_ip());
    if (file_exists($file)) @unlink($file);
}

// ─── Main login logic ─────────────────────────────────────────────────────────

// Check rate limit BEFORE reading the body (fail-fast on lockout)
check_rate_limit();

$data  = get_json();
// Strip whitespace from email - users often paste spaces by accident
$email = strtolower(trim($data['email']    ?? ''));
$pass  = $data['password'] ?? '';

if (!$email || !$pass) {
    json_out(['error' => 'Email and password are required'], 400);
}

try {
    $db   = get_db();
    $stmt = $db->prepare(
        'SELECT id, name, email, password, role FROM users WHERE email = ?'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();
} catch (Throwable $e) {
    db_error($e);
}

// ── Secure error message: never reveal whether the email is registered ─────────
if (!$user || !check_password($pass, $user['password'])) {
    record_failed_attempt();
    // Always return the same generic message to prevent user enumeration
    json_out(['error' => 'Invalid email or password'], 401);
}

// Successful login - clear the failed-attempt counter for this IP
clear_failed_attempts();

$token = make_token((int) $user['id']);
json_out(['token' => $token, 'user' => user_payload($user)]);

