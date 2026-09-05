<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(['error' => 'Method not allowed'], 405);
}

require_admin();

try {
    $db = get_db();

    $total_users = (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn();

    $bookings_today = (int) $db->query(
        "SELECT COUNT(*) FROM appointments WHERE date = CURDATE() AND status != 'cancelled'"
    )->fetchColumn();

    $total_services = (int) $db->query('SELECT COUNT(*) FROM services')->fetchColumn();

    $bookings_mtd = (int) $db->query(
        "SELECT COUNT(*) FROM appointments
         WHERE MONTH(date) = MONTH(CURDATE())
           AND YEAR(date)  = YEAR(CURDATE())
           AND status != 'cancelled'"
    )->fetchColumn();

    $total_bookings = (int) $db->query(
        "SELECT COUNT(*) FROM appointments WHERE status NOT IN ('cancelled')"
    )->fetchColumn();

    json_out([
        'total_users'     => $total_users,
        'bookings_today'  => $bookings_today,
        'total_services'  => $total_services,
        'bookings_mtd'    => $bookings_mtd,
        'total_bookings'  => $total_bookings,
    ]);
} catch (Throwable $e) {
    db_error($e);
}
