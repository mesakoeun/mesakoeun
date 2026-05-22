<?php
require_once 'db.php';

function getProvinces() {
    global $pdo;
    try {
        $stmt = $pdo->query("SELECT id, name FROM tbl_province ORDER BY name ASC");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error']);
    }
}

function getDistricts($province_id) {
    global $pdo;
    try {
        $stmt = $pdo->prepare("SELECT id, name FROM tbl_district WHERE province_id = ?");
        $stmt->execute([$province_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error']);
    }
}

function getCommunes($district_id) {
    global $pdo;
    try {
        $stmt = $pdo->prepare("SELECT id, name FROM tbl_commune WHERE district_id = ?");
        $stmt->execute([$district_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error']);
    }
}

function getVillages($commune_id) {
    global $pdo;
    try {
        $stmt = $pdo->prepare("SELECT id, name FROM tbl_village WHERE commune_id = ?");
        $stmt->execute([$commune_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($rows);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error']);
    }
}

function searchPeople() {
    global $pdo;
    $givenname = $_GET['givenname'] ?? '';
    $surname = $_GET['surname'] ?? '';
    $gender = $_GET['gender'] ?? '';
    $province_id = $_GET['province_id'] ?? '';
    $district_id = $_GET['district_id'] ?? '';
    $commune_id = $_GET['commune_id'] ?? '';
    $village_id = $_GET['village_id'] ?? '';
    $age_from = $_GET['age_from'] ?? '';
    $age_to = $_GET['age_to'] ?? '';
    $page = (int)($_GET['page'] ?? 1);

    $limit = 100;
    $offset = ($page - 1) * $limit;

    $whereClause = " WHERE 1=1";
    $params = [];
    if (!empty($givenname)) {
        $whereClause .= " AND TRIM(givenname) = ?";
        $params[] = trim($givenname);
    }
    if (!empty($surname)) {
        $whereClause .= " AND TRIM(surname) = ?";
        $params[] = trim($surname);
    }
    if (!empty($gender)) {
        $whereClause .= " AND gender = ?";
        $params[] = $gender;
    }
    if (!empty($province_id)) {
        $whereClause .= " AND province_id = ?";
        $params[] = $province_id;
    }
    if (!empty($district_id)) {
        $whereClause .= " AND district_id = ?";
        $params[] = $district_id;
    }
    if (!empty($commune_id)) {
        $whereClause .= " AND commune_id = ?";
        $params[] = $commune_id;
    }
    if (!empty($village_id)) {
        $whereClause .= " AND village_id = ?";
        $params[] = $village_id;
    }
    $currentYear = date('Y');
    if (!empty($age_from)) {
        $yearFrom = $currentYear - (int)$age_from;
        $whereClause .= " AND dob <= ?";
        $params[] = $yearFrom . '-12-31';
    }
    if (!empty($age_to)) {
        $yearTo = $currentYear - (int)$age_to;
        $whereClause .= " AND dob >= ?";
        $params[] = $yearTo . '-01-01';
    }

    try {
        $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM people $whereClause");
        $countStmt->execute($params);
        $totalRecords = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

        $dataSql = "SELECT * FROM people $whereClause LIMIT ? OFFSET ?";
        $stmt = $pdo->prepare($dataSql);
        $stmt->execute(array_merge($params, [$limit, $offset]));
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'data' => $rows,
            'pagination' => [
                'totalRecords' => (int)$totalRecords,
                'currentPage' => $page,
                'totalPages' => ceil($totalRecords / $limit),
            ],
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>