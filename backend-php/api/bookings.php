<?php
/**
 * PUT  /api/bookings/{id}  - update date/time
 * DELETE /api/bookings/{id}  - cancel booking
 *
 * The booking ID comes from the URL rewrite: ?id=123
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

$current_user = require_auth();
$method       = $_SERVER['REQUEST_METHOD'];
$booking_id   = (int) ($_GET['id'] ?? 0);

if (!$booking_id) {
    json_out(['error' => 'Booking ID is required'], 400);
}

// ── DELETE - cancel booking ─────────────────────────────────────────────────
if ($method === 'DELETE') {
    try {
        $db   = get_db();
        $stmt = $db->prepare(
            "UPDATE appointments SET status = 'cancelled'
             WHERE id = ? AND user_id = ?"
        );
        $stmt->execute([$booking_id, (int) $current_user['id']]);

        if ($stmt->rowCount() === 0) {
            json_out(['error' => 'Booking not found'], 404);
        }
        json_out(['ok' => true]);
    } catch (Throwable $e) {
        db_error($e);
    }
}

// ── PUT - update date & time ────────────────────────────────────────────────
if ($method === 'PUT') {
    $data     = get_json();
    $date_str = trim($data['date'] ?? '');
    $time_str = trim($data['time'] ?? '');

    if (!$date_str || !$time_str) {
        json_out(['error' => 'date and time are required'], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date_str)) {
        json_out(['error' => 'Invalid date'], 400);
    }

    try {
        $db = get_db();

        // Ownership check
        $stmt = $db->prepare(
            "SELECT id FROM appointments
             WHERE id = ? AND user_id = ? AND status != 'cancelled'"
        );
        $stmt->execute([$booking_id, (int) $current_user['id']]);
        if (!$stmt->fetch()) {
            json_out(['error' => 'Booking not found'], 404);
        }

        // Slot conflict check
        $stmt = $db->prepare(
            "SELECT id FROM appointments
             WHERE date = ? AND time = ? AND id != ? AND status != 'cancelled'"
        );
        $stmt->execute([$date_str, $time_str, $booking_id]);
        if ($stmt->fetch()) {
            json_out(['error' => 'That time slot is already booked'], 409);
        }

        $stmt = $db->prepare(
            'UPDATE appointments SET date = ?, time = ? WHERE id = ?'
        );
        $stmt->execute([$date_str, $time_str, $booking_id]);
        json_out(['ok' => true]);

    } catch (Throwable $e) {
        if (str_contains($e->getMessage(), '1062')) {
            json_out(['error' => 'That time slot is already booked'], 409);
        }
        db_error($e);
    }
}

json_out(['error' => 'Method not allowed'], 405);
