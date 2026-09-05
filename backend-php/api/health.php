<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

try {
    $db = get_db();
    $db->query('SELECT 1');
    json_out(['ok' => true, 'database' => 'connected']);
} catch (Throwable $e) {
    json_out(['ok' => false, 'error' => $e->getMessage()], 500);
}
