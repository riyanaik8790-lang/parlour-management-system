<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_out(['error' => 'Method not allowed'], 405);
}

$current_user = require_auth();

try {
    $db   = get_db();
    $stmt = $db->prepare(
        "SELECT a.id, s.name AS service_name,
                DATE_FORMAT(a.date, '%Y-%m-%d') AS date,
                a.time, a.status
         FROM   appointments a
         JOIN   services s ON s.id = a.service_id
         WHERE  a.user_id = ? AND a.status != 'cancelled'
         ORDER  BY a.date DESC, a.time DESC"
    );
    $stmt->execute([(int) $current_user['id']]);
    $bookings = $stmt->fetchAll();

    // Cast id to int
    foreach ($bookings as &$b) {
        $b['id'] = (int) $b['id'];
    }

    json_out(['bookings' => $bookings]);
} catch (Throwable $e) {
    db_error($e);
}
