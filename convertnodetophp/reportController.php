<?php
require_once 'db.php';

function getDemographicReport() {
    global $pdo;
    $province_id = $_GET['province_id'] ?? '';
    $district_id = $_GET['district_id'] ?? '';
    $commune_id = $_GET['commune_id'] ?? '';
    $age_from = $_GET['age_from'] ?? '';
    $age_to = $_GET['age_to'] ?? '';
    $gender = $_GET['gender'] ?? '';

    $groupByCol = "";
    $joinTable = "";
    $joinCondition = "";
    $nameCol = "";
    $whereClause = " WHERE 1=1";
    $params = [];
    if (!empty($gender)) {
        $whereClause .= " AND s.gender = ?";
        $params[] = $gender;
    }

    if (!empty($commune_id)) {
        $groupByCol = "s.village_id";
        $joinTable = "tbl_village";
        $joinCondition = "s.village_id = loc.id";
        $nameCol = "Village Name";
        $whereClause .= " AND s.commune_id = ?";
        $params[] = $commune_id;
    } elseif (!empty($district_id)) {
        $groupByCol = "s.commune_id";
        $joinTable = "tbl_commune";
        $joinCondition = "s.commune_id = loc.id";
        $nameCol = "Commune Name";
        $whereClause .= " AND s.district_id = ?";
        $params[] = $district_id;
    } elseif (!empty($province_id)) {
        $groupByCol = "s.district_id";
        $joinTable = "tbl_district";
        $joinCondition = "s.district_id = loc.id";
        $nameCol = "District Name";
        $whereClause .= " AND s.province_id = ?";
        $params[] = $province_id;
    } else {
        $groupByCol = "s.province_id";
        $joinTable = "tbl_province";
        $joinCondition = "s.province_id = loc.id";
        $nameCol = "Province Name";
    }

    $selectColumns = "loc.name AS location_name";
    $currentYear = date('Y');

    if (!empty($age_from) && !empty($age_to)) {
        $start = (int)$age_from;
        $end = (int)$age_to;
        for ($age = $start; $age <= $end; $age++) {
            $targetYear = $currentYear - $age;
            $selectColumns .= ", COALESCE(SUM(CASE WHEN s.birth_year = $targetYear THEN s.total_people ELSE 0 END), 0) AS 'Age $age'";
        }
    } else {
        $selectColumns .= ", COALESCE(SUM(CASE WHEN s.gender = 'Male' THEN s.total_people ELSE 0 END), 0) AS 'Male'";
        $selectColumns .= ", COALESCE(SUM(CASE WHEN s.gender = 'Female' THEN s.total_people ELSE 0 END), 0) AS 'Female'";
        $selectColumns .= ", COALESCE(SUM(s.total_people), 0) AS 'Total'";
    }

    $sql = "SELECT $selectColumns FROM summary_demographics s JOIN $joinTable loc ON $joinCondition $whereClause GROUP BY $groupByCol, loc.name ORDER BY loc.name ASC";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $headers = ["No", $nameCol];
        if (!empty($age_from) && !empty($age_to)) {
            $start = (int)$age_from;
            $end = (int)$age_to;
            for ($i = $start; $i <= $end; $i++) {
                $headers[] = "Age $i";
            }
        } else {
            $headers[] = "Male";
            $headers[] = "Female";
            $headers[] = "Total";
        }

        echo json_encode(['headers' => $headers, 'data' => $rows]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>