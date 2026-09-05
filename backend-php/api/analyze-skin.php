<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Method not allowed'], 405);
}

// Accept multipart form upload (image file) - just return stub analysis
json_out([
    'skin_tone'          => 'Medium Warm',
    'undertone'          => 'warm',
    'recommended_palette'=> ['#c19a6b', '#b7410e', '#e2a07a', '#6b7a3a', '#f3e5c3'],
    'matching_services'  => ['Gold Bleach', 'Fruit Cleanup', 'Party Makeup'],
]);
