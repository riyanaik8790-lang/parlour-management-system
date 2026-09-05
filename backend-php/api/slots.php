<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(['error' => 'Method not allowed'], 405);
}

$date_str = trim($_GET['date'] ?? '');

// Validate YYYY-MM-DD format
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_str)) {
    json_out(['error' => 'Invalid date. Use YYYY-MM-DD'], 400);
}

try {
    $db   = get_db();
    $stmt = $db->prepare(
        "SELECT time FROM appointments WHERE date = ? AND status != 'cancelled'"
    );
    $stmt->execute([$date_str]);
    $taken = array_column($stmt->fetchAll(), 'time');
    json_out(['taken' => $taken]);
} catch (Throwable $e) {
    db_error($e);
}
