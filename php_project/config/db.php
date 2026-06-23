<?php
require_once 'config/config.php';

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

/**
 * Helper to send JSON responses
 */
function sendResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Simple Auth Check
 */
function checkAuth($requiredRole = null) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (!$authHeader) {
        sendResponse(['error' => 'Unauthorized'], 401);
    }

    // Decode base64 token: "username:role"
    $decoded = base64_decode($authHeader);
    if (!$decoded) {
        sendResponse(['error' => 'Invalid token'], 401);
    }

    list($username, $role) = explode(':', $decoded);

    if ($requiredRole && $role !== $requiredRole) {
        sendResponse(['error' => 'Forbidden: Higher privileges required'], 403);
    }

    return ['username' => $username, 'role' => $role];
}
?>
