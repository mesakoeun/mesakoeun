<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once 'config/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Normalize path: remove trailing slashes and handle potential subdirectories
$path = trim($uri, '/');
if (strpos($path, 'index.php') !== false) {
    $path = preg_replace('/^index\.php/', '', $path);
}
$path = '/' . trim($path, '/');

// Simple Router
if ($path === '/' || $path === '/index.php') {
    sendResponse(['message' => 'Welcome to Registry API']);
}

if ($path === '/api/login' && $method === 'POST') {
    require_once 'api/auth.php';
    handleLogin($pdo);
} elseif ($path === '/api/provinces' || $path === '/api/districts' || $path === '/api/communes' || $path === '/api/villages') {
    require_once 'api/locations.php';
    handleLocations($pdo, $path);
} elseif ($path === '/api/report' && $method === 'GET') {
    require_once 'api/reports.php';
    handleReport($pdo);
} elseif (preg_match('#^/api/people(/([0-9]+)(/history)?)?$#', $path, $matches)) {
    require_once 'api/people.php';
    $id = $matches[2] ?? null;
    $subPath = $matches[3] ?? null;
    handlePeople($pdo, $method, $id, $subPath);
} elseif ($path === '/api/search' && $method === 'GET') {
    require_once 'api/people.php';
    handleSearch($pdo);
} else {
    sendResponse(['error' => 'Endpoint not found'], 404);
}
?>
