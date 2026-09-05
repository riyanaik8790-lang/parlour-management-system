<?php
/**
 * GET /api/admin/bookings                        - list all bookings (optional ?status=)
 * PUT /api/admin/bookings/{id}/status            - update booking status
 */
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../auth.php';

header('Content-Type: application/json');

$admin  = require_admin();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;
$action = $_GET['action'] ?? '';

// ── PUT /api/admin/bookings/{id}/status ────────────────────────────────────
if ($method === 'PUT' && $id && $action === 'status') {
    $data       = get_json();
    $new_status = strtolower(trim($data['status'] ?? ''));
    $allowed    = ['confirmed', 'cancelled', 'completed', 'no-show'];

    if (!in_array($new_status, $allowed, true)) {
        json_out(['error' => 'status must be one of: ' . implode(', ', $allowed)], 400);
    }

    try {
        $db   = get_db();
        $stmt = $db->prepare('UPDATE appointments SET status = ? WHERE id = ?');
        $stmt->execute([$new_status, $id]);

        if ($stmt->rowCount() === 0) {
            json_out(['error' => 'Booking not found'], 404);
        }
        json_out(['ok' => true]);
    } catch (Throwable $e) {
        db_error($e);
    }
}

// ── GET /api/admin/bookings ────────────────────────────────────────────────
if ($method === 'GET') {
    $status_filter = trim($_GET['status'] ?? '');
    try {
        $db  = get_db();
        $sql = "SELECT a.id, DATE_FORMAT(a.date,'%Y-%m-%d') AS date, a.time,
                       a.status, a.created_at,
                       u.id AS user_id, u.name AS user_name,
                       u.email AS user_email, u.phone AS user_phone,
                       s.id AS service_id, s.name AS service_name,
                       s.price AS service_price, s.category
                FROM   appointments a
                JOIN   users u ON u.id = a.user_id
                JOIN   services s ON s.id = a.service_id";

        if ($status_filter && $status_filter !== 'all') {
            $stmt = $db->prepare($sql . ' WHERE a.status = ? ORDER BY a.date DESC, a.time DESC');
            $stmt->execute([$status_filter]);
        } else {
            $stmt = $db->query($sql . ' ORDER BY a.date DESC, a.time DESC');
        }

        $bookings = $stmt->fetchAll();
        foreach ($bookings as &$b) {
            $b['id']      = (int) $b['id'];
            $b['user_id'] = (int) $b['user_id'];
        }
        json_out(['total' => count($bookings), 'bookings' => $bookings]);
    } catch (Throwable $e) {
        db_error($e);
    }
}

json_out(['error' => 'Method not allowed'], 405);
