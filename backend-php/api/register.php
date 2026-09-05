<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Method not allowed'], 405);
}

$data  = get_json();
$name  = trim($data['name']  ?? '');
$email = strtolower(trim($data['email']  ?? ''));
$pass  = $data['password'] ?? '';
$phone = trim($data['phone'] ?? '');

// Validation
if (strlen($name) < 2 || strlen($name) > 80) {
    json_out(['error' => 'Name must be 2–80 characters'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 120) {
    json_out(['error' => 'Invalid email address'], 400);
}
if (strlen($pass) < 6 || strlen($pass) > 72) {
    json_out(['error' => 'Password must be 6–72 characters'], 400);
}
if (strlen($phone) < 7 || strlen($phone) > 20) {
    json_out(['error' => 'Enter a valid phone number'], 400);
}

try {
    $db   = get_db();
    $stmt = $db->prepare(
        'INSERT INTO users (name, email, password, phone) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$name, $email, hash_password($pass), $phone]);
    $id = (int) $db->lastInsertId();

    $row = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
    $row->execute([$id]);
    $user = $row->fetch();

    $token = make_token($id);
    json_out(['token' => $token, 'user' => user_payload($user)], 201);

} catch (Throwable $e) {
    // MySQL duplicate-entry errno 1062
    if (str_contains($e->getMessage(), '1062')) {
        json_out(['error' => 'An account with this email already exists'], 409);
    }
    db_error($e);
}
