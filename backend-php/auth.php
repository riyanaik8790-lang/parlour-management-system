<?php
/**
 * Pure-PHP JWT helpers - no Composer needed.
 * Uses HMAC-SHA256, fully compatible with the Python PyJWT tokens already in use.
 */

require_once __DIR__ . '/config.php';

// --------------------------------------------------------------------------
// JWT
// --------------------------------------------------------------------------

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad) $data .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($data, '-_', '+/'));
}

function make_token(int $user_id): string {
    $secret       = env('JWT_SECRET', 'dev-secret-change-me');
    $expiry_hours = (int) env('JWT_EXPIRY_HOURS', '168');

    $header  = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url_encode(json_encode([
        'sub' => $user_id,
        'iat' => time(),
        'exp' => time() + $expiry_hours * 3600,
    ]));

    $sig = base64url_encode(hash_hmac('SHA256', "$header.$payload", $secret, true));
    return "$header.$payload.$sig";
}

function verify_token(string $token): ?array {
    $secret = env('JWT_SECRET', 'dev-secret-change-me');
    $parts  = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $sig] = $parts;
    $expected = base64url_encode(hash_hmac('SHA256', "$header.$payload", $secret, true));

    // Constant-time comparison prevents timing attacks
    if (!hash_equals($expected, $sig)) return null;

    $data = json_decode(base64url_decode($payload), true);
    if (!is_array($data)) return null;
    if (!isset($data['exp']) || $data['exp'] < time()) return null;

    return $data;
}

// --------------------------------------------------------------------------
// Auth middleware helpers
// --------------------------------------------------------------------------

function get_bearer_token(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) return null;
    return substr($header, 7);
}

/**
 * Returns the current user row from DB, or sends 401 and exits.
 */
function require_auth(): array {
    $token = get_bearer_token();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Login required']);
        exit;
    }

    $payload = verify_token($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session. Please login again.']);
        exit;
    }

    try {
        $db   = get_db();
        $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
        $stmt->execute([$payload['sub']]);
        $user = $stmt->fetch();
    } catch (Throwable $e) {
        db_error($e);
    }

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'User not found']);
        exit;
    }

    return $user;
}

/**
 * Same as require_auth but also checks role === 'ADMIN'.
 */
function require_admin(): array {
    $user = require_auth();
    if (($user['role'] ?? '') !== 'ADMIN') {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: Admin access required']);
        exit;
    }
    return $user;
}

// --------------------------------------------------------------------------
// Password
// --------------------------------------------------------------------------

function hash_password(string $plain): string {
    // PASSWORD_BCRYPT produces $2y$ hashes - compatible with Python bcrypt $2b$
    return password_hash($plain, PASSWORD_BCRYPT);
}

function check_password(string $plain, string $hashed): bool {
    // password_verify() accepts both $2y$ (PHP) and $2b$ (Python) prefixes
    return password_verify($plain, $hashed);
}

// --------------------------------------------------------------------------
// Input helpers
// --------------------------------------------------------------------------

function get_json(): array {
    $body = file_get_contents('php://input');
    return json_decode($body ?: '{}', true) ?? [];
}

function json_out(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function user_payload(array $user): array {
    return [
        'id'    => $user['id'],
        'name'  => $user['name'],
        'email' => $user['email'],
        'role'  => $user['role'] ?? 'USER',
    ];
}
