<?php
/**
 * GET  /api/skin-analysis  - list user's saved analyses
 * POST /api/skin-analysis  - save a new analysis
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

$current_user = require_auth();
$method       = $_SERVER['REQUEST_METHOD'];

// Palette data (same as recommendations.php)
$palettes = [
    'warm' => [
        'undertone' => 'warm',
        'summary'   => 'You have a warm undertone with golden, peachy warmth. Earthy, sun-kissed shades will make your complexion glow.',
        'hair'    => [['name'=>'Honey Caramel','hex'=>'#a9743b'],['name'=>'Warm Chestnut','hex'=>'#6b3f21'],['name'=>'Copper Auburn','hex'=>'#b5651d']],
        'makeup'  => [['name'=>'Peach Nude','hex'=>'#e2a07a'],['name'=>'Terracotta','hex'=>'#c96b52'],['name'=>'Warm Berry','hex'=>'#a24a5f']],
        'outfits' => [['name'=>'Camel','hex'=>'#c19a6b'],['name'=>'Olive','hex'=>'#6b7a3a'],['name'=>'Rust','hex'=>'#b7410e'],['name'=>'Cream','hex'=>'#f3e5c3']],
        'services'=> ['Gold Bleach','Fruit Cleanup','Party Makeup'],
    ],
    'cool' => [
        'undertone' => 'cool',
        'summary'   => 'You have a cool undertone with pink or bluish notes. Jewel tones and soft pastels will flatter your skin beautifully.',
        'hair'    => [['name'=>'Ash Brown','hex'=>'#5a4a3f'],['name'=>'Cool Espresso','hex'=>'#3b2a24'],['name'=>'Platinum Blonde','hex'=>'#e5e4e2']],
        'makeup'  => [['name'=>'Rose Pink','hex'=>'#d97a95'],['name'=>'Berry Wine','hex'=>'#7b2a3d'],['name'=>'Mauve','hex'=>'#a76a8a']],
        'outfits' => [['name'=>'Sapphire','hex'=>'#0f52ba'],['name'=>'Emerald','hex'=>'#046a38'],['name'=>'Icy Lavender','hex'=>'#c8b6d6'],['name'=>'Charcoal','hex'=>'#36454f']],
        'services'=> ['Herbal / Oxy Bleach','Party Makeup','Facial'],
    ],
    'neutral' => [
        'undertone' => 'neutral',
        'summary'   => 'You have a balanced neutral undertone. A wide range of colors flatters you - try muted, versatile shades.',
        'hair'    => [['name'=>'Natural Brown','hex'=>'#6f4e37'],['name'=>'Soft Mahogany','hex'=>'#8b3a3a'],['name'=>'Warm Black','hex'=>'#1c1c1c']],
        'makeup'  => [['name'=>'Rosy Nude','hex'=>'#c98a8a'],['name'=>'Dusty Rose','hex'=>'#c48b8b'],['name'=>'Soft Plum','hex'=>'#734f5b']],
        'outfits' => [['name'=>'Dusty Blue','hex'=>'#6a8caf'],['name'=>'Blush','hex'=>'#dea5a4'],['name'=>'Sage','hex'=>'#9caf88'],['name'=>'Taupe','hex'=>'#8b7d6b']],
        'services'=> ['Fruit Cleanup','Bridal Makeup','Facial'],
    ],
];

// ── GET - list analyses ─────────────────────────────────────────────────────
if ($method === 'GET') {
    try {
        $db   = get_db();
        $stmt = $db->prepare(
            'SELECT id, hex, depth, undertone, created_at
             FROM skin_analyses
             WHERE user_id = ?
             ORDER BY created_at DESC'
        );
        $stmt->execute([(int) $current_user['id']]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int) $r['id'];
        }
        json_out(['analyses' => $rows]);
    } catch (Throwable $e) {
        db_error($e);
    }
}

// ── POST - save analysis ────────────────────────────────────────────────────
if ($method === 'POST') {
    $data      = get_json();
    $hex       = trim($data['hex']       ?? '');
    $depth     = trim($data['depth']     ?? '');
    $undertone = trim($data['undertone'] ?? '');

    if (!array_key_exists($undertone, $palettes)) {
        json_out(['error' => 'undertone must be warm, cool, or neutral'], 400);
    }
    if (!$hex || !$depth) {
        json_out(['error' => 'hex and depth are required'], 400);
    }

    try {
        $db   = get_db();
        $stmt = $db->prepare(
            'INSERT INTO skin_analyses (user_id, hex, depth, undertone) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([(int) $current_user['id'], $hex, $depth, $undertone]);
        $id = (int) $db->lastInsertId();

        json_out(array_merge(['id' => $id], $palettes[$undertone]), 201);
    } catch (Throwable $e) {
        db_error($e);
    }
}

json_out(['error' => 'Method not allowed'], 405);
