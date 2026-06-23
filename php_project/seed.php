<?php
/**
 * Data Seeder for Registry System
 * This script generates large scale random data for the 'people' table.
 * 
 * Usage: php seed.php
 */

require_once 'config/config.php';

// Increase memory limit and execution time for large scale seeding
ini_set('memory_limit', '512M');
set_time_limit(0);

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

    $TOTAL_RECORDS = 2000000;
    $BATCH_SIZE = 10000;
    $currentYear = (int)date('Y');

    echo "🚀 Starting bulk insert of " . number_format($TOTAL_RECORDS) . " records...\n";
    $startTime = microtime(true);

    // 1. Pre-load location data for hierarchical random selection
    echo "📍 Loading location hierarchies...\n";

    $provinceIds = $pdo->query("SELECT id FROM tbl_province")->fetchAll(PDO::FETCH_COLUMN);
    
    $districtMap = [];
    $districts = $pdo->query("SELECT id, province_id FROM tbl_district")->fetchAll();
    foreach ($districts as $d) {
        $districtMap[$d['province_id']][] = $d['id'];
    }

    $communeMap = [];
    $communes = $pdo->query("SELECT id, district_id FROM tbl_commune")->fetchAll();
    foreach ($communes as $c) {
        $communeMap[$c['district_id']][] = $c['id'];
    }

    $villageMap = [];
    $villages = $pdo->query("SELECT id, commune_id FROM tbl_village")->fetchAll();
    foreach ($villages as $v) {
        $villageMap[$v['commune_id']][] = $v['id'];
    }

    echo "✅ Loaded: " . count($provinceIds) . " provinces, " . count($districts) . " districts, " . count($communes) . " communes, " . count($villages) . " villages\n";

    // Random data pools
    $firstNames = ['Sok', 'Chan', 'Vannak', 'Sophea', 'Bora', 'Srey', 'Phalla', 'Rath', 'Kalyan', 'Sothy', 'Nimul', 'Sovan', 'Piseth', 'leakhena', 'Dara'];
    $lastNames = ['Chea', 'Heng', 'Sok', 'Kim', 'Lim', 'Chan', 'Vong', 'Keo', 'Mao', 'Nuon', 'Seng', 'Tep', 'Yim', 'Bun', 'Chhorn'];
    $genders = ['Male', 'Female'];

    // Prepare the insert statement
    $sql = "INSERT INTO people (givenname, surname, gender, dob, province_id, district_id, commune_id, village_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);

    $pdo->beginTransaction();
    $count = 0;

    for ($i = 0; $i < $TOTAL_RECORDS; $i++) {
        // Age 15-80
        $age = rand(15, 80);
        $birthYear = $currentYear - $age;
        $month = str_pad(rand(1, 12), 2, "0", STR_PAD_LEFT);
        $day = str_pad(rand(1, 28), 2, "0", STR_PAD_LEFT);
        $dob = "$birthYear-$month-$day";

        // Hierarchical random location
        $province_id = $provinceIds[array_rand($provinceIds)];
        
        $district_id = null;
        $commune_id = null;
        $village_id = null;

        if (isset($districtMap[$province_id])) {
            $district_id = $districtMap[$province_id][array_rand($districtMap[$province_id])];
            if (isset($communeMap[$district_id])) {
                $commune_id = $communeMap[$district_id][array_rand($communeMap[$district_id])];
                if (isset($villageMap[$commune_id])) {
                    $village_id = $villageMap[$commune_id][array_rand($villageMap[$commune_id])];
                }
            }
        }

        $stmt->execute([
            $firstNames[array_rand($firstNames)] . ' ' . (rand(0,1) ? 'Jr' : ''),
            $lastNames[array_rand($lastNames)],
            $genders[array_rand($genders)],
            $dob,
            $province_id,
            $district_id,
            $commune_id,
            $village_id
        ]);

        $count++;

        // Commit batch
        if ($count % $BATCH_SIZE === 0) {
            $pdo->commit();
            $pdo->beginTransaction();
            
            $percentage = (($count / $TOTAL_RECORDS) * 100);
            echo "✅ Progress: " . number_format($count) . " records (" . number_format($percentage, 1) . "%)\n";
        }
    }

    $pdo->commit();
    $endTime = microtime(true);
    $executionTime = $endTime - $startTime;

    echo "\n✨ Success! " . number_format($TOTAL_RECORDS) . " records inserted.\n";
    echo "Total Execution Time: " . number_format($executionTime, 2) . " seconds\n";

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "❌ Critical Error during seeding: " . $e->getMessage() . "\n";
}
?>
