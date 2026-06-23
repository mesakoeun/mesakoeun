<?php
function handleLocations($pdo, $path) {
    if ($path === '/api/provinces') {
        $stmt = $pdo->query("SELECT id, name_khmer FROM tbl_province ORDER BY id ASC");
        sendResponse($stmt->fetchAll());
    } elseif ($path === '/api/districts') {
        $province_id = $_GET['province_id'] ?? null;
        if (!$province_id) sendResponse(['error' => 'province_id is required'], 400);
        $stmt = $pdo->prepare("SELECT id, name_khmer FROM tbl_district WHERE province_id = ?");
        $stmt->execute([$province_id]);
        sendResponse($stmt->fetchAll());
    } elseif ($path === '/api/communes') {
        $district_id = $_GET['district_id'] ?? null;
        if (!$district_id) sendResponse(['error' => 'district_id is required'], 400);
        $stmt = $pdo->prepare("SELECT id, name_khmer FROM tbl_commune WHERE district_id = ?");
        $stmt->execute([$district_id]);
        sendResponse($stmt->fetchAll());
    } elseif ($path === '/api/villages') {
        $commune_id = $_GET['commune_id'] ?? null;
        if (!$commune_id) sendResponse(['error' => 'commune_id is required'], 400);
        $stmt = $pdo->prepare("SELECT id, name_khmer FROM tbl_village WHERE commune_id = ?");
        $stmt->execute([$commune_id]);
        sendResponse($stmt->fetchAll());
    }
}
?>
