<?php
/**
 * GET /api/admin/users                   - list all users
 * PUT /api/admin/users/{id}/promote      - promote to ADMIN
 *
 * Route rewrite passes ?id=X&action=promote for the promote call.
 */
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../auth.php';

header('Content-Type: application/json');

$admin  = require_admin();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;
$action = $_GET['action'] ?? '';

// ── PUT /api/admin/users/{id}/promote ──────────────────────────────────────
if ($method === 'PUT' && $id && $action === 'promote') {
    try {
        $db   = get_db();
        $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $target = $stmt->fetch();

        if (!$target) {
            json_out(['error' => 'User not found'], 404);
        }
        if ($target['role'] === 'ADMIN') {
            json_out(['error' => 'User is already an admin'], 409);
        }

        $db->prepare('UPDATE users SET role = ? WHERE id = ?')->execute(['ADMIN', $id]);
        json_out(['ok' => true, 'message' => $target['name'] . ' has been promoted to ADMIN']);
    } catch (Throwable $e) {
        db_error($e);
    }
}

// ── GET /api/admin/users ───────────────────────────────────────────────────
if ($method === 'GET') {
    try {
        $db   = get_db();
        $stmt = $db->query(
            'SELECT id, name, email, phone, role, created_at
             FROM users ORDER BY created_at DESC'
        );
        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['id'] = (int) $u['id'];
        }
        json_out(['total' => count($users), 'users' => $users]);
    } catch (Throwable $e) {
        db_error($e);
    }
}

json_out(['error' => 'Method not allowed'], 405);
