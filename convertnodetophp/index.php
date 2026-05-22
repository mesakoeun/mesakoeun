<?php
// index.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'peopleController.php';
require_once 'reportController.php';

$requestUri = $_SERVER['REQUEST_URI'];
$path = parse_url($requestUri, PHP_URL_PATH);

// Remove leading /api if present
$path = preg_replace('/^\/api/', '', $path);

if ($path === '/report' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    getDemographicReport();
} elseif ($path === '/provinces' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    getProvinces();
} elseif (preg_match('/^\/districts\/(\d+)$/', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    getDistricts($matches[1]);
} elseif (preg_match('/^\/communes\/(\d+)$/', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    getCommunes($matches[1]);
} elseif (preg_match('/^\/villages\/(\d+)$/', $path, $matches) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    getVillages($matches[1]);
} elseif ($path === '/search' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    searchPeople();
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Endpoint not found']);
}
?>