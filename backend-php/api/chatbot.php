<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['error' => 'Method not allowed'], 405);
}

$data    = get_json();
$message = trim($data['message'] ?? '');

if (!$message) {
    json_out(['error' => 'message is required'], 400);
}

$m = strtolower($message);

// Try to detect a date in the message to show booked slots
$taken      = [];
$date_match = null;

// Simple date detection: look for "tomorrow", "today", or YYYY-MM-DD
if (str_contains($m, 'today')) {
    $date_match = date('Y-m-d');
} elseif (str_contains($m, 'tomorrow')) {
    $date_match = date('Y-m-d', strtotime('+1 day'));
} elseif (preg_match('/\b(\d{4}-\d{2}-\d{2})\b/', $message, $dmatch)) {
    $date_match = $dmatch[1];
}

if ($date_match) {
    try {
        $db   = get_db();
        $stmt = $db->prepare(
            "SELECT time FROM appointments WHERE date = ? AND status != 'cancelled'"
        );
        $stmt->execute([$date_match]);
        $taken = array_column($stmt->fetchAll(), 'time');
    } catch (Throwable) {
        $taken = [];
    }
}

// Keyword-based reply (same logic as Python chatbot)
if (str_contains($m, 'price') || str_contains($m, 'cost')) {
    json_out([
        'reply' => 'Our services start from ₹10 for threading and go up to premium bridal packages. Visit the Services page for the full menu.',
        'suggestions' => ['View services', 'Book an appointment', 'Bridal packages'],
    ]);
}

if (str_contains($m, 'book') || str_contains($m, 'appointment')) {
    $taken_note = $taken ? ' Taken slots for that day: ' . implode(', ', $taken) . '.' : '';
    json_out([
        'reply' => 'You can book instantly from the Book page - pick a service, date, and open time slot.' . $taken_note,
        'suggestions' => ['Book now', 'View my bookings'],
    ]);
}

if (str_contains($m, 'skin') || str_contains($m, 'tone') || str_contains($m, 'undertone')) {
    json_out([
        'reply' => 'Try our Skin Try-On tool - upload a selfie and we\'ll suggest hair, makeup, and outfit shades that flatter your undertone.',
        'suggestions' => ['Try skin analyzer', 'See recommendations'],
    ]);
}

if (str_contains($m, 'cancel') || str_contains($m, 'reschedule')) {
    json_out([
        'reply' => 'You can cancel or reschedule any booking from the My Bookings page.',
        'suggestions' => ['My bookings'],
    ]);
}

if (str_contains($m, 'hour') || str_contains($m, 'open') || str_contains($m, 'timing')) {
    json_out([
        'reply' => 'We are open from 10:00 AM to 8:00 PM, Monday to Saturday.',
        'suggestions' => ['Book now', 'View services'],
    ]);
}

// Default reply
json_out([
    'reply' => 'Hi! I\'m the Hemangi Glam assistant. Ask me about services, prices, booking, or skin tone recommendations.',
    'suggestions' => ['View services', 'Book an appointment', 'Try skin analyzer'],
]);
