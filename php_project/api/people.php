<?php
/**
 * Helper to normalize DOB for consistency
 */
function normalizeDob($value) {
    if (!$value) return null;
    $text = trim((string)$value);
    return (strlen($text) >= 10) ? substr($text, 0, 10) : $text;
}

/**
 * Ensure edit_history table exists
 */
function ensureEditHistoryTable($pdo) {
    $sql = "CREATE TABLE IF NOT EXISTS edit_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        person_id INT NOT NULL,
        action ENUM('INSERT','UPDATE') NOT NULL,
        old_values JSON NULL,
        new_values JSON NULL,
        changed_by VARCHAR(50) NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    $pdo->exec($sql);
}

function handleSearch($pdo) {
    $givenname   = trim($_GET['givenname'] ?? '');
    $surname     = trim($_GET['surname'] ?? '');
    $gender      = $_GET['gender'] ?? '';
    $province_id = $_GET['province_id'] ?? null;
    $district_id = $_GET['district_id'] ?? null;
    $commune_id  = $_GET['commune_id'] ?? null;
    $village_id  = $_GET['village_id'] ?? null;
    $age_from    = $_GET['age_from'] ?? null;
    $age_to      = $_GET['age_to'] ?? null;
    $page        = isset($_GET['page']) ? (int)$_GET['page'] : 1;

    $limit  = 100;
    $offset = ($page - 1) * $limit;

    $where = " WHERE 1=1";
    $params = [];

    if ($givenname !== '') {
        $where .= " AND givenname LIKE ?";
        $params[] = "%$givenname%";
    }
    if ($surname !== '') {
        $where .= " AND surname LIKE ?";
        $params[] = "%$surname%";
    }
    if (!empty($gender)) {
        $where .= " AND gender = ?";
        $params[] = $gender;
    }
    if ($province_id) {
        $where .= " AND province_id = ?";
        $params[] = $province_id;
    }
    if ($district_id) {
        $where .= " AND district_id = ?";
        $params[] = $district_id;
    }
    if ($commune_id) {
        $where .= " AND commune_id = ?";
        $params[] = $commune_id;
    }
    if ($village_id) {
        $where .= " AND village_id = ?";
        $params[] = $village_id;
    }

    if ($age_from || $age_to) {
        $currentYear = (int)date("Y");
        if ($age_from) {
            $yearFrom = $currentYear - (int)$age_from;
            $where .= " AND dob <= ?";
            $params[] = "$yearFrom-12-31";
        }
        if ($age_to) {
            $yearTo = $currentYear - (int)$age_to;
            $where .= " AND dob >= ?";
            $params[] = "$yearTo-01-01";
        }
    }

    // Count total records
    $stmtCount = $pdo->prepare("SELECT COUNT(*) as total FROM people $where");
    $stmtCount->execute($params);
    $totalRecords = (int)$stmtCount->fetch()['total'];

    // Fetch data
    $sql = "SELECT * FROM people $where LIMIT ? OFFSET ?";
    $stmtData = $pdo->prepare($sql);
    
    $i = 1;
    foreach ($params as $p) {
        $stmtData->bindValue($i++, $p);
    }
    $stmtData->bindValue($i++, $limit, PDO::PARAM_INT);
    $stmtData->bindValue($i++, $offset, PDO::PARAM_INT);
    $stmtData->execute();

    sendResponse([
        "data" => $stmtData->fetchAll(),
        "pagination" => [
            "totalRecords" => $totalRecords,
            "currentPage" => $page,
            "totalPages" => ceil($totalRecords / $limit)
        ]
    ]);
}

function handlePeople($pdo, $method, $id, $subPath) {
    if ($method === 'GET') {
        if ($subPath === '/history') {
            // GET /api/people/:id/history
            if (!$id) sendResponse(['error' => 'ID is required'], 400);
            ensureEditHistoryTable($pdo);
            $stmt = $pdo->prepare("SELECT * FROM edit_history WHERE person_id = ? ORDER BY changed_at DESC");
            $stmt->execute([$id]);
            sendResponse($stmt->fetchAll());
        } else {
            // GET /api/people/:id
            if (!$id) sendResponse(['error' => 'ID is required'], 400);
            $sql = "SELECT p.id, p.givenname, p.surname, p.gender, DATE(p.dob) AS dob,
                           p.province_id, p.district_id, p.commune_id, p.village_id,
                           pr.name_khmer AS province_name, d.name_khmer AS district_name,
                           c.name_khmer AS commune_name, v.name_khmer AS village_name
                    FROM people p
                    LEFT JOIN tbl_province pr ON pr.id = p.province_id
                    LEFT JOIN tbl_district d ON d.id = p.district_id
                    LEFT JOIN tbl_commune c ON c.id = p.commune_id
                    LEFT JOIN tbl_village v ON v.id = p.village_id
                    WHERE p.id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$id]);
            $person = $stmt->fetch();
            if (!$person) sendResponse(['error' => 'Person not found'], 404);
            $person['dob'] = normalizeDob($person['dob']);
            sendResponse($person);
        }
    } elseif ($method === 'POST') {
        // POST /api/people (Create)
        $auth = checkAuth('admin');
        $input = json_decode(file_get_contents('php://input'), true);
        
        $givenname = $input['givenname'] ?? '';
        $surname   = $input['surname'] ?? '';
        if (!$givenname || !$surname) sendResponse(['error' => 'Given name and surname are required'], 400);

        ensureEditHistoryTable($pdo);
        $sql = "INSERT INTO people (givenname, surname, gender, dob, province_id, district_id, commune_id, village_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $givenname, 
            $surname, 
            $input['gender'] ?? null, 
            normalizeDob($input['dob'] ?? null), 
            $input['province_id'] ?? null, 
            $input['district_id'] ?? null, 
            $input['commune_id'] ?? null, 
            $input['village_id'] ?? null
        ]);

        $personId = $pdo->lastInsertId();
        
        // Audit trail
        $newValues = json_encode([
            'id' => $personId, 'givenname' => $givenname, 'surname' => $surname, 
            'gender' => $input['gender'] ?? null, 'dob' => normalizeDob($input['dob'] ?? null), 
            'province_id' => $input['province_id'] ?? null, 'district_id' => $input['district_id'] ?? null, 
            'commune_id' => $input['commune_id'] ?? null, 'village_id' => $input['village_id'] ?? null
        ]);
        $stmtHist = $pdo->prepare("INSERT INTO edit_history (person_id, action, old_values, new_values, changed_by) VALUES (?, 'INSERT', NULL, ?, ?)");
        $stmtHist->execute([$personId, $newValues, $auth['username']]);

        // Refresh summary cache
        $pdo->exec("CALL RefreshSummary()");

        sendResponse(['id' => $personId, 'message' => 'Person created successfully'], 201);

    } elseif ($method === 'PUT') {
        // PUT /api/people/:id (Update)
        if (!$id) sendResponse(['error' => 'ID is required'], 400);
        $auth = checkAuth('admin');
        $input = json_decode(file_get_contents('php://input'), true);

        $stmtOld = $pdo->prepare("SELECT * FROM people WHERE id = ?");
        $stmtOld->execute([$id]);
        $oldData = $stmtOld->fetch();
        if (!$oldData) sendResponse(['error' => 'Person not found'], 404);

        $updatedValues = [
            'givenname' => $input['givenname'] ?? $oldData['givenname'],
            'surname'   => $input['surname'] ?? $oldData['surname'],
            'gender'    => $input['gender'] ?? $oldData['gender'],
            'dob'       => normalizeDob($input['dob'] ?? $oldData['dob']),
            'province_id' => $input['province_id'] ?? $oldData['province_id'],
            'district_id' => $input['district_id'] ?? $oldData['district_id'],
            'commune_id'  => $input['commune_id'] ?? $oldData['commune_id'],
            'village_id'  => $input['village_id'] ?? $oldData['village_id'],
        ];

        $sql = "UPDATE people SET givenname=?, surname=?, gender=?, dob=?, province_id=?, district_id=?, commune_id=?, village_id=? WHERE id=?";
        $stmtUpd = $pdo->prepare($sql);
        $stmtUpd->execute([
            $updatedValues['givenname'], $updatedValues['surname'], $updatedValues['gender'], 
            $updatedValues['dob'], $updatedValues['province_id'], $updatedValues['district_id'], 
            $updatedValues['commune_id'], $updatedValues['village_id'], $id
        ]);

        // Audit trail
        $stmtHist = $pdo->prepare("INSERT INTO edit_history (person_id, action, old_values, new_values, changed_by) VALUES (?, 'UPDATE', ?, ?, ?)");
        $stmtHist->execute([
            $id, 
            json_encode($oldData), 
            json_encode($updatedValues), 
            $auth['username']
        ]);

        // Refresh summary cache
        $pdo->exec("CALL RefreshSummary()");

        sendResponse(['message' => 'Person updated successfully']);
    } else {
        sendResponse(['error' => 'Method not allowed'], 405);
    }
}
?>
