<?php
function handleLogin($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    if (!$username || !$password) {
        sendResponse(['error' => 'Username and password are required'], 400);
    }

    if (isset(ADMIN_CREDENTIALS[$username]) && ADMIN_CREDENTIALS[$username] === $password) {
        $role = ($username === 'admin') ? 'admin' : 'user';
        sendResponse([
            'role' => $role,
            'username' => $username,
            'token' => base64_encode("$username:$role")
        ]);
    }

    sendResponse(['error' => 'Invalid credentials'], 401);
}
?>
