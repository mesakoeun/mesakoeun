<?php
function handleReport($pdo) {
    $province_id = $_GET['province_id'] ?? null;
    $district_id = $_GET['district_id'] ?? null;
    $commune_id  = $_GET['commune_id']  ?? null;
    $age_from    = $_GET['age_from']    ?? null;
    $age_to      = $_GET['age_to']      ?? null;
    $gender      = $_GET['gender']      ?? null;

    $groupByCol   = '';
    $joinTable    = '';
    $joinCondition = '';
    $nameCol      = '';
    $whereClause  = ' WHERE 1=1';
    $params       = [];

    if (!empty($gender)) {
        $whereClause .= ' AND s.gender = ?';
        $params[] = $gender;
    }

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

    // Refresh summary if empty
    $check = $pdo->query("SELECT COUNT(*) as cnt FROM summary_demographics")->fetch();
    if ($check['cnt'] == 0) {
        $pdo->exec("CALL RefreshSummary()");
    }

    $selectColumns = 'loc.name_khmer AS location_name';
    $headers       = ['No', $nameCol];
    $currentYear   = (int) date('Y');

    if (!empty($age_from) && !empty($age_to)) {
        $start = (int) $age_from;
        $end   = (int) $age_to;
        for ($age = $start; $age <= $end; $age++) {
            $targetYear = $currentYear - $age;
            $selectColumns .= ", COALESCE(SUM(CASE WHEN s.birth_year = {$targetYear} THEN s.total_people ELSE 0 END), 0) AS 'Age {$age}'";
            $headers[] = "Age {$age}";
        }
    } else {
        $selectColumns .= ", COALESCE(SUM(CASE WHEN s.gender = 'Male' THEN s.total_people ELSE 0 END), 0) AS 'Male',
                            COALESCE(SUM(CASE WHEN s.gender = 'Female' THEN s.total_people ELSE 0 END), 0) AS 'Female',
                            COALESCE(SUM(s.total_people), 0) AS 'Total'";
        array_push($headers, 'Male', 'Female', 'Total');
    }

    $sql = "SELECT {$selectColumns} FROM summary_demographics s JOIN {$joinTable} loc ON {$joinCondition} {$whereClause} GROUP BY {$groupByCol}, loc.name_khmer ORDER BY loc.name_khmer ASC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    sendResponse(['headers' => $headers, 'data' => $stmt->fetchAll()]);
}
?>
