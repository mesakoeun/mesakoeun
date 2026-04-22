<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
require "db.php";

function getDemographicReport($pdo, $queryParams) {
    $province_id = $queryParams['province_id'] ?? null;
    $district_id = $queryParams['district_id'] ?? null;
    $commune_id  = $queryParams['commune_id']  ?? null;
    $age_from    = $queryParams['age_from']    ?? null;
    $age_to      = $queryParams['age_to']      ?? null;
    $gender      = $queryParams['gender']      ?? null;

    $groupByCol   = '';
    $joinTable    = '';
    $joinCondition = '';
    $nameCol      = '';
    $whereClause  = ' WHERE 1=1';
    $params       = [];

    // --- Gender Filter ---
    if (!empty($gender)) {
        $whereClause .= ' AND s.gender = ?';
        $params[] = $gender;
    }

    // --- 1. Determine Hierarchy ---
    if ($commune_id) {
        $groupByCol    = 's.village_id';
        $joinTable     = 'tbl_village';
        $joinCondition = 's.village_id = loc.id';
        $nameCol       = 'Village Name';
        $whereClause  .= ' AND s.commune_id = ?';
        $params[]      = $commune_id;
    } elseif ($district_id) {
        $groupByCol    = 's.commune_id';
        $joinTable     = 'tbl_commune';
        $joinCondition = 's.commune_id = loc.id';
        $nameCol       = 'Commune Name';
        $whereClause  .= ' AND s.district_id = ?';
        $params[]      = $district_id;
    } elseif ($province_id) {
        $groupByCol    = 's.district_id';
        $joinTable     = 'tbl_district';
        $joinCondition = 's.district_id = loc.id';
        $nameCol       = 'District Name';
        $whereClause  .= ' AND s.province_id = ?';
        $params[]      = $province_id;
    } else {
        $groupByCol    = 's.province_id';
        $joinTable     = 'tbl_province';
        $joinCondition = 's.province_id = loc.id';
        $nameCol       = 'Province Name';
    }

    // --- 2. Dynamic Pivot Columns ---
    $selectColumns = 'loc.name AS location_name';
    $headers       = ['No', $nameCol];
    $currentYear   = (int) date('Y');

    if (!empty($age_from) && !empty($age_to)) {
        $start = (int) $age_from;
        $end   = (int) $age_to;

        for ($age = $start; $age <= $end; $age++) {
            $targetYear     = $currentYear - $age;
            $selectColumns .= ",
                COALESCE(SUM(CASE WHEN s.birth_year = {$targetYear} THEN s.total_people ELSE 0 END), 0) AS 'Age {$age}'";
            $headers[] = "Age {$age}";
        }
    } else {
        $selectColumns .= ",
            COALESCE(SUM(CASE WHEN s.gender = 'Male'   THEN s.total_people ELSE 0 END), 0) AS 'Male',
            COALESCE(SUM(CASE WHEN s.gender = 'Female' THEN s.total_people ELSE 0 END), 0) AS 'Female',
            COALESCE(SUM(s.total_people), 0) AS 'Total'";
        array_push($headers, 'Male', 'Female', 'Total');
    }

    // --- 3. Query the Summary Table ---
    $sql = "
        SELECT {$selectColumns}
        FROM summary_demographics s
        JOIN {$joinTable} loc ON {$joinCondition}
        {$whereClause}
        GROUP BY {$groupByCol}, loc.name
        ORDER BY loc.name ASC
    ";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'headers' => $headers,
            'data'    => $rows,
        ];
    } catch (\PDOException $e) {
        http_response_code(500);
        return ['error' => $e->getMessage()];
    }
}


$action = $_GET['action'] ?? '';

try {
    if ($action === "report") {
        $result = getDemographicReport($pdo, $_GET);
        echo json_encode($result);
        exit;
    }

    // ✅ Provinces
    if ($action === "provinces") {
        $stmt = $pdo->query("SELECT id, name FROM tbl_province ORDER BY name ASC");
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // ✅ Districts
    if ($action === "districts") {
        $stmt = $pdo->prepare("SELECT id, name FROM tbl_district WHERE province_id = ?");
        $stmt->execute([$_GET['province_id'] ?? null]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // ✅ Communes
    if ($action === "communes") {
        $stmt = $pdo->prepare("SELECT id, name FROM tbl_commune WHERE district_id = ?");
        $stmt->execute([$_GET['district_id'] ?? null]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // ✅ Villages
    if ($action === "villages") {
        $stmt = $pdo->prepare("SELECT id, name FROM tbl_village WHERE commune_id = ?");
        $stmt->execute([$_GET['commune_id'] ?? null]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // ✅ Search People (main logic)
    if ($action === "search") {

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
            $where .= " AND TRIM(givenname) = ?";
            $params[] = $givenname;
        }

        if ($surname !== '') {
            $where .= " AND TRIM(surname) = ?";
            $params[] = $surname;
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

        // ✅ Age filter (same logic as Node.js)
        if ($age_from || $age_to) {
            $currentYear = date("Y");

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

        // ✅ Count query
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM people $where");
        $stmt->execute($params);
        $totalRecords = $stmt->fetch()['total'];

        // ✅ Data query
        $sql = "SELECT * FROM people $where LIMIT ? OFFSET ?";
        $stmt = $pdo->prepare($sql);

        // bind values manually for LIMIT/OFFSET (important for MySQL)
        $i = 1;
        foreach ($params as $p) {
            $stmt->bindValue($i++, $p);
        }
        $stmt->bindValue($i++, $limit, PDO::PARAM_INT);
        $stmt->bindValue($i++, $offset, PDO::PARAM_INT);

        $stmt->execute();
        $rows = $stmt->fetchAll();

        echo json_encode([
            "data" => $rows,
            "pagination" => [
                "totalRecords" => (int)$totalRecords,
                "currentPage" => $page,
                "totalPages" => ceil($totalRecords / $limit)
            ]
        ]);
        exit;
    }



// ❌ Invalid route
    echo json_encode(["error" => "Invalid endpoint"]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database error"]);
}
