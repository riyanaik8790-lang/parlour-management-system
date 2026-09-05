<?php
// Force PHP to use IST so date() matches the user's local date
date_default_timezone_set('Asia/Kolkata');
/**
 * Database config - reads from backend/.env if it exists,
 * then falls back to environment variables, then to XAMPP defaults.
 */

function load_env(string $path): void {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (!str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $key = trim($key);
        $val = trim($val);
        if (!isset($_ENV[$key])) {
            $_ENV[$key] = $val;
            putenv("$key=$val");
        }
    }
}

// Load .env from the sibling backend/ folder
load_env(__DIR__ . '/../backend/.env');

function env(string $key, string $default = ''): string {
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

function get_db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $host = env('MYSQL_HOST', 'localhost');
    $port = env('MYSQL_PORT', '3306');
    $user = env('MYSQL_USER', 'root');
    $pass = env('MYSQL_PASSWORD', '');
    $db   = env('MYSQL_DATABASE', 'salon_db');

    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    // Force MySQL session timezone to IST so CURDATE() returns the correct local date
    $pdo->exec("SET time_zone = '+05:30'");
    return $pdo;
}

function db_error(Throwable $e, int $code = 500): never {
    http_response_code($code);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    exit;
}
