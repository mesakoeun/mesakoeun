<?php
// db.php - use environment variables and safer error handling
$host = getenv('DB_HOST') ?: '192.168.2.129';
$user = getenv('DB_USER') ?: 'admin_people';
$password = getenv('DB_PASSWORD') ?: 'password123';
$database = getenv('DB_NAME') ?: 'db_people';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$database;charset=utf8", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    error_log('Database connection failed: ' . $e->getMessage());
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}
?>