<?php
/**
 * Data Seeder for Registry System using Faker
 * Usage: php seed.php
 */

require_once 'config/config.php';
require_once 'vendor/autoload.php'; // Required for Faker

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

    $faker = Faker\Factory::create();
    $TOTAL_RECORDS = 2000000;
    $BATCH_SIZE = 10000;
    $currentYear = (int)date('Y');

    echo "🚀 Starting bulk insert of " . number_format($TOTAL_RECORDS) . " records using Faker...\n";
    $startTime = microtime(true);

    // Pre-load location data
    echo "📍 Loading location hierarchies...\n";
    $provinceIds = $pdo->query("SELECT id FROM tbl_province")->fetchAll(PDO::FETCH_COLUMN);
    
    $districtMap = [];
    foreach ($pdo->query("SELECT id, province_id FROM tbl_district") as $d) {
        $districtMap[$d['province_id']][] = $d['id'];
    }

    $communeMap = [];
    foreach ($pdo->query("SELECT id, district_id FROM tbl_commune") as $c) {
        $communeMap[$c['district_id']][] = $c['id'];
    }

    $villageMap = [];
    foreach ($pdo->query("SELECT id, commune_id FROM tbl_village") as $v) {
        $villageMap[$v['commune_id']][] = $v['id'];
    }

    $sql = "INSERT INTO people (givenname, surname, gender, dob, province_id, district_id, commune_id, village_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);

    $pdo->beginTransaction();
    $count = 0;

    for ($i = 0; $i < $TOTAL_RECORDS; $i++) {
        $age = rand(15, 80);
        $dob = $faker->dateTimeBetween("-{$age} years", "-".($age-1)." years")->format('Y-m-d');

        $province_id = $provinceIds[array_rand($provinceIds)];
        $district_id = $commune_id = $village_id = null;

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
            $faker->firstName,
            $faker->lastName,
            $faker->randomElement(['Male', 'Female']),
            $dob,
            $province_id,
            $district_id,
            $commune_id,
            $village_id
        ]);

        $count++;
        if ($count % $BATCH_SIZE === 0) {
            $pdo->commit();
            $pdo->beginTransaction();
            echo "✅ Progress: " . number_format($count) . " records (" . number_format(($count/$TOTAL_RECORDS)*100, 1) . "%)\n";
        }
    }

    $pdo->commit();
    echo "\n✨ Success! " . number_format($TOTAL_RECORDS) . " records inserted in " . number_format(microtime(true) - $startTime, 2) . "s\n";

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
}