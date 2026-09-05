<?php
/**
 * router.php - PHP built-in dev-server router
 * Replaces Apache + .htaccess so you don't need XAMPP Apache at all.
 *
 * Run with:
 *   C:\xampp\php\php.exe -S localhost:5000 -t backend-php backend-php/router.php
 * (from the project root: cloud-test-companion-main\)
 */

// ── CORS headers (allow the Vite dev server at :8080) ─────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Route the request to the right PHP file ───────────────────────────────────
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = trim($uri, '/');

// Serve real files/directories as-is (e.g. direct .php hits during debugging)
$real = __DIR__ . '/' . $uri;
if (is_file($real)) return false;

// ── Route table (mirrors the .htaccess rules) ─────────────────────────────────
$apiDir = __DIR__ . '/api';

$routes = [
    // Admin routes
    'admin/users'                                       => "$apiDir/admin/users.php",
    'admin/bookings'                                    => "$apiDir/admin/bookings.php",
    'admin/stats'                                       => "$apiDir/admin/stats.php",

    // Bookings with ID  e.g. /bookings/3
    '#^bookings/(\d+)$#'                               => "$apiDir/bookings.php",

    // Admin routes with ID + action
    '#^admin/users/(\d+)/promote$#'                    => "$apiDir/admin/users.php",
    '#^admin/bookings/(\d+)/status$#'                  => "$apiDir/admin/bookings.php",

    // Simple routes - matched last
    'login'                                             => "$apiDir/login.php",
    'register'                                          => "$apiDir/register.php",
    'book'                                              => "$apiDir/book.php",
    'bookings'                                          => "$apiDir/bookings.php",
    'my-bookings'                                       => "$apiDir/my-bookings.php",
    'slots'                                             => "$apiDir/slots.php",
    'health'                                            => "$apiDir/health.php",
    'recommendations'                                   => "$apiDir/recommendations.php",
    'chatbot'                                           => "$apiDir/chatbot.php",
    'analyze-skin'                                      => "$apiDir/analyze-skin.php",
    'skin-analysis'                                     => "$apiDir/skin-analysis.php",
];

header('Content-Type: application/json');

foreach ($routes as $pattern => $file) {
    if ($pattern[0] === '#') {
        // Regex pattern (for routes with IDs)
        if (preg_match($pattern, $uri, $matches)) {
            // Put captures into $_GET so PHP files can use $_GET['id'] etc.
            if (isset($matches[1])) $_GET['id'] = $matches[1];
            if (strpos($file, 'promote') !== false) $_GET['action'] = 'promote';
            if (strpos($file, 'status')  !== false) $_GET['action'] = 'status';
            require $file;
            exit;
        }
    } else {
        // Exact string match
        if ($uri === $pattern) {
            require $file;
            exit;
        }
    }
}

// No route matched
http_response_code(404);
echo json_encode(['error' => "Route not found: /$uri"]);
