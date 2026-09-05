<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Method not allowed'], 405);
}

$current_user = require_auth();

$data       = get_json();
$service_id = trim($data['service_id'] ?? '');
$date_str   = trim($data['date']       ?? '');
$time_str   = trim($data['time']       ?? '');

if (!$service_id || !$date_str || !$time_str) {
    json_out(['error' => 'service_id, date, and time are required'], 400);
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_str)) {
    json_out(['error' => 'Invalid date'], 400);
}

// Cannot book in the past
if ($date_str < date('Y-m-d')) {
    json_out(['error' => 'Cannot book a past date'], 400);
}

try {
    $db = get_db();

    // Check service exists
    $stmt = $db->prepare('SELECT id FROM services WHERE id = ?');
    $stmt->execute([$service_id]);
    if (!$stmt->fetch()) {
        json_out(['error' => 'Unknown service'], 400);
    }

    // Check slot is free
    $stmt = $db->prepare(
        "SELECT id FROM appointments WHERE date = ? AND time = ? AND status != 'cancelled'"
    );
    $stmt->execute([$date_str, $time_str]);
    if ($stmt->fetch()) {
        json_out(['error' => 'That time slot is already booked. Pick another.'], 409);
    }

    // Insert booking
    $stmt = $db->prepare(
        "INSERT INTO appointments (user_id, service_id, date, time, status)
         VALUES (?, ?, ?, ?, 'confirmed')"
    );
    $stmt->execute([(int) $current_user['id'], $service_id, $date_str, $time_str]);
    $booking_id = (int) $db->lastInsertId();

    json_out(['id' => $booking_id], 201);

} catch (Throwable $e) {
    if (str_contains($e->getMessage(), '1062')) {
        json_out(['error' => 'That time slot is already booked. Pick another.'], 409);
    }
    db_error($e);
}
