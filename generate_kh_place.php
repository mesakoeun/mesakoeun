<?php
/**
 * generate_kh_places_sql.php
 *
 * Reads the full national kh-places.csv (all 25 provinces) and generates
 * correct SQL INSERTs for tbl_province, tbl_district, tbl_commune, tbl_village.
 *
 * Cambodia geocode structure (leading zeros dropped in CSV):
 *   Provinces 01-09  →  district = 3 digits (e.g. 102),  commune = 5,  village = 7
 *   Provinces 10-25  →  district = 4 digits (e.g. 1001), commune = 6,  village = 8
 *
 * Fix from previous version:
 *   - provinceKey() now correctly handles both 3-digit and 4-digit district codes
 *   - districtKey() / communeKey() handle variable-length codes
 *   - All 25 provinces included in lookup table
 *   - Duplicate CSV rows are de-duplicated automatically (last-write wins by code)
 *   - ខណ្ឌ (Khan) treated as a district-level type
 *
 * Usage:
 *   php generate_kh_places_sql.php
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
define('CSV_FILE',   __DIR__ . '/kh-places.csv');
define('SQL_OUTPUT', __DIR__ . '/kh-places-insert.sql'); // null → stdout

// Full Cambodia province lookup keyed by 2-digit province code (string)
$PROVINCES = [
    '01' => ['name_latin' => 'Banteay Meanchey',   'name_khmer' => 'ខេត្តបន្ទាយមានជ័យ'],
    '02' => ['name_latin' => 'Battambang',          'name_khmer' => 'ខេត្តបាត់ដំបង'],
    '03' => ['name_latin' => 'Kampong Cham',        'name_khmer' => 'ខេត្តកំពង់ចាម'],
    '04' => ['name_latin' => 'Kampong Chhnang',     'name_khmer' => 'ខេត្តកំពង់ឆ្នាំង'],
    '05' => ['name_latin' => 'Kampong Speu',        'name_khmer' => 'ខេត្តកំពង់ស្ពឺ'],
    '06' => ['name_latin' => 'Kampong Thom',        'name_khmer' => 'ខេត្តកំពង់ធំ'],
    '07' => ['name_latin' => 'Kampot',              'name_khmer' => 'ខេត្តកំពត'],
    '08' => ['name_latin' => 'Kandal',              'name_khmer' => 'ខេត្តកណ្ដាល'],
    '09' => ['name_latin' => 'Koh Kong',            'name_khmer' => 'ខេត្តកោះកុង'],
    '10' => ['name_latin' => 'Kratie',              'name_khmer' => 'ខេត្តក្រចេះ'],
    '11' => ['name_latin' => 'Mondul Kiri',         'name_khmer' => 'ខេត្តមណ្ឌលគិរី'],
    '12' => ['name_latin' => 'Phnom Penh',          'name_khmer' => 'រាជធានីភ្នំពេញ'],
    '13' => ['name_latin' => 'Preah Vihear',        'name_khmer' => 'ខេត្តព្រះវិហារ'],
    '14' => ['name_latin' => 'Prey Veng',           'name_khmer' => 'ខេត្តព្រៃវែង'],
    '15' => ['name_latin' => 'Pursat',              'name_khmer' => 'ខេត្តពោធិ៍សាត់'],
    '16' => ['name_latin' => 'Ratanak Kiri',        'name_khmer' => 'ខេត្តរតនគិរី'],
    '17' => ['name_latin' => 'Siem Reap',           'name_khmer' => 'ខេត្តសៀមរាប'],
    '18' => ['name_latin' => 'Preah Sihanouk',      'name_khmer' => 'ខេត្តព្រះសីហនុ'],
    '19' => ['name_latin' => 'Stung Treng',         'name_khmer' => 'ខេត្តស្ទឹងត្រែង'],
    '20' => ['name_latin' => 'Svay Rieng',          'name_khmer' => 'ខេត្តស្វាយរៀង'],
    '21' => ['name_latin' => 'Takeo',               'name_khmer' => 'ខេត្តតាកែវ'],
    '22' => ['name_latin' => 'Oddar Meanchey',      'name_khmer' => 'ខេត្តឧត្ដរមានជ័យ'],
    '23' => ['name_latin' => 'Kep',                 'name_khmer' => 'ខេត្តកែប'],
    '24' => ['name_latin' => 'Pailin',              'name_khmer' => 'ខេត្តប៉ៃលិន'],
    '25' => ['name_latin' => 'Tboung Khmum',        'name_khmer' => 'ខេត្តត្បូងឃ្មុំ'],
];

// Khmer type labels
const TYPE_DISTRICT = 'ស្រុក';
const TYPE_CITY     = 'ក្រុង';
const TYPE_KHAN     = 'ខណ្ឌ';   // urban district (Phnom Penh)
const TYPE_COMMUNE  = 'ឃុំ';
const TYPE_SANGKAT  = 'សង្កាត់';
const TYPE_VILLAGE  = 'ភូមិ';

// INSERT batch size for large tables
const BATCH_SIZE = 500;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function sqlStr(?string $v): string
{
    if ($v === null || $v === '') return 'NULL';
    return "'" . str_replace(["\\", "'"], ["\\\\", "\\'"], $v) . "'";
}
function sqlInt(?int $v): string { return $v === null ? 'NULL' : (string)$v; }

/**
 * Province key from a district code (2-char, zero-padded).
 *   3-digit district → province 01-09  e.g. "102" → "01"
 *   4-digit district → province 10-25  e.g. "1001" → "10"
 */
function provinceKey(string $code): string
{
    return strlen($code) === 3 ? '0' . $code[0] : substr($code, 0, 2);
}

/**
 * District code from a commune code.
 *   5-digit commune → 3-digit district  e.g. "10201" → "102"
 *   6-digit commune → 4-digit district  e.g. "100101" → "1001"
 */
function districtKey(string $code): string
{
    return strlen($code) === 5 ? substr($code, 0, 3) : substr($code, 0, 4);
}

/**
 * Commune code from a village code.
 *   7-digit village → 5-digit commune  e.g. "1020101" → "10201"
 *   8-digit village → 6-digit commune  e.g. "10010101" → "100101"
 */
function communeKey(string $code): string
{
    return strlen($code) === 7 ? substr($code, 0, 5) : substr($code, 0, 6);
}

function buildBatches(array $rows, int $size): array
{
    return array_chunk(array_values($rows), $size);
}

// ─────────────────────────────────────────────────────────────────────────────
// READ & DE-DUPLICATE CSV
// ─────────────────────────────────────────────────────────────────────────────
if (!file_exists(CSV_FILE)) { fwrite(STDERR, "ERROR: CSV not found.\n"); exit(1); }
$handle = fopen(CSV_FILE, 'r');
if (!$handle)               { fwrite(STDERR, "ERROR: Cannot open CSV.\n"); exit(1); }

$header = fgetcsv($handle);
// Strip UTF-8 BOM
if (isset($header[0])) $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);

$colMap = [];
foreach ($header as $i => $col) $colMap[trim($col)] = $i;

foreach (['Type', 'Code', 'Name (Khmer)', 'Name (Latin)'] as $col) {
    if (!array_key_exists($col, $colMap)) {
        fwrite(STDERR, "ERROR: Missing column '{$col}'.\n"); exit(1);
    }
}

$iType  = $colMap['Type'];
$iCode  = $colMap['Code'];
$iKhmer = $colMap['Name (Khmer)'];
$iLatin = $colMap['Name (Latin)'];

$districtRows = [];
$communeRows  = [];
$villageRows  = [];

$lineNum = 1;
$skipped = 0;

while (($row = fgetcsv($handle)) !== false) {
    $lineNum++;
    if (count($row) < 4) continue;

    $type  = trim($row[$iType]);
    $code  = trim($row[$iCode]);
    $khmer = trim($row[$iKhmer]);
    $latin = trim($row[$iLatin]);

    if ($code === '') continue;

    // Keying by $code deduplicates identical codes automatically.
    switch ($type) {
        case TYPE_DISTRICT:
        case TYPE_CITY:
        case TYPE_KHAN:
            $districtRows[$code] = [
                'code'         => $code,
                'province_key' => provinceKey($code),
                'name_latin'   => $latin,
                'name_khmer'   => $khmer,
            ];
            break;

        case TYPE_COMMUNE:
        case TYPE_SANGKAT:
            $communeRows[$code] = [
                'code'         => $code,
                'district_key' => districtKey($code),
                'name_latin'   => $latin,
                'name_khmer'   => $khmer,
            ];
            break;

        case TYPE_VILLAGE:
            $villageRows[$code] = [
                'code'        => $code,
                'commune_key' => communeKey($code),
                'name_latin'  => $latin,
                'name_khmer'  => $khmer,
            ];
            break;

        default:
            $skipped++;
    }
}
fclose($handle);

if ($skipped > 0) {
    fwrite(STDERR, "INFO: {$skipped} rows with unrecognised type skipped.\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN AUTO-INCREMENT IDs
// ─────────────────────────────────────────────────────────────────────────────
$provinceId = [];
$districtId = [];
$communeId  = [];

// Only include provinces that actually appear in the data
$usedProvinceCodes = array_unique(
    array_map(fn($d) => $d['province_key'], $districtRows)
);
sort($usedProvinceCodes);

$pid = 1;
foreach ($usedProvinceCodes as $pCode) {
    $provinceId[$pCode] = $pid++;
}

$did = 1;
foreach ($districtRows as $code => $d) {
    $districtId[$code] = $did++;
}

$cid = 1;
foreach ($communeRows as $code => $c) {
    $communeId[$code] = $cid++;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD SQL
// ─────────────────────────────────────────────────────────────────────────────
$out = [];

$out[] = "-- ==================================================================";
$out[] = "-- Cambodia Places — Full National INSERT Statements";
$out[] = "-- Generated  : " . date('Y-m-d H:i:s');
$out[] = "-- Provinces  : " . count($provinceId);
$out[] = "-- Districts  : " . count($districtRows);
$out[] = "-- Communes   : " . count($communeRows);
$out[] = "-- Villages   : " . count($villageRows);
$out[] = "-- ==================================================================";
$out[] = "";
$out[] = "SET NAMES utf8mb4;";
$out[] = "SET CHARACTER SET utf8mb4;";
$out[] = "SET FOREIGN_KEY_CHECKS = 0;";
$out[] = "";

// ── tbl_province ─────────────────────────────────────────────────────────────
$out[] = "-- ------------------------------------------------------------------";
$out[] = "-- tbl_province  (" . count($provinceId) . " rows)";
$out[] = "-- ------------------------------------------------------------------";
$out[] = "INSERT INTO `tbl_province` (`id`, `name_latin`, `name_khmer`) VALUES";
$rows = [];
foreach ($usedProvinceCodes as $pCode) {
    $pData = $PROVINCES[$pCode] ?? ['name_latin' => "Province {$pCode}", 'name_khmer' => ''];
    $rows[] = sprintf("  (%s, %s, %s)",
        sqlInt($provinceId[$pCode]),
        sqlStr($pData['name_latin']),
        sqlStr($pData['name_khmer'])
    );
}
$out[] = implode(",\n", $rows) . ";";
$out[] = "";

// ── tbl_district ─────────────────────────────────────────────────────────────
$out[] = "-- ------------------------------------------------------------------";
$out[] = "-- tbl_district  (" . count($districtRows) . " rows)";
$out[] = "-- ------------------------------------------------------------------";

foreach (buildBatches($districtRows, BATCH_SIZE) as $batch) {
    $out[] = "INSERT INTO `tbl_district` (`id`, `province_id`, `name_latin`, `name_khmer`) VALUES";
    $rows = [];
    foreach ($batch as $d) {
        $pid  = $provinceId[$d['province_key']] ?? null;
        if ($pid === null) fwrite(STDERR, "WARN: no province for district {$d['code']}\n");
        $rows[] = sprintf("  (%s, %s, %s, %s)",
            sqlInt($districtId[$d['code']]),
            sqlInt($pid),
            sqlStr($d['name_latin']),
            sqlStr($d['name_khmer'])
        );
    }
    $out[] = implode(",\n", $rows) . ";";
    $out[] = "";
}

// ── tbl_commune ──────────────────────────────────────────────────────────────
$out[] = "-- ------------------------------------------------------------------";
$out[] = "-- tbl_commune  (" . count($communeRows) . " rows)";
$out[] = "-- ------------------------------------------------------------------";

foreach (buildBatches($communeRows, BATCH_SIZE) as $batch) {
    $out[] = "INSERT INTO `tbl_commune` (`id`, `province_id`, `district_id`, `name_latin`, `name_khmer`) VALUES";
    $rows = [];
    foreach ($batch as $c) {
        $dKey = $c['district_key'];
        $did  = $districtId[$dKey] ?? null;
        $pKey = isset($districtRows[$dKey]) ? $districtRows[$dKey]['province_key'] : null;
        $pid  = $pKey ? ($provinceId[$pKey] ?? null) : null;
        if ($did === null) fwrite(STDERR, "WARN: no district for commune {$c['code']}\n");
        $rows[] = sprintf("  (%s, %s, %s, %s, %s)",
            sqlInt($communeId[$c['code']]),
            sqlInt($pid),
            sqlInt($did),
            sqlStr($c['name_latin']),
            sqlStr($c['name_khmer'])
        );
    }
    $out[] = implode(",\n", $rows) . ";";
    $out[] = "";
}

// ── tbl_village ──────────────────────────────────────────────────────────────
$out[] = "-- ------------------------------------------------------------------";
$out[] = "-- tbl_village  (" . count($villageRows) . " rows)";
$out[] = "-- ------------------------------------------------------------------";

$vid = 1;
foreach (buildBatches($villageRows, BATCH_SIZE) as $batch) {
    $out[] = "INSERT INTO `tbl_village` (`id`, `province_id`, `district_id`, `commune_id`, `name_latin`, `name_khmer`) VALUES";
    $rows = [];
    foreach ($batch as $v) {
        $cKey = $v['commune_key'];
        $cid  = $communeId[$cKey] ?? null;
        $dKey = isset($communeRows[$cKey]) ? $communeRows[$cKey]['district_key'] : null;
        $did  = $dKey ? ($districtId[$dKey] ?? null) : null;
        $pKey = $dKey && isset($districtRows[$dKey]) ? $districtRows[$dKey]['province_key'] : null;
        $pid  = $pKey ? ($provinceId[$pKey] ?? null) : null;
        if ($cid === null) fwrite(STDERR, "WARN: no commune for village {$v['code']}\n");
        $rows[] = sprintf("  (%s, %s, %s, %s, %s, %s)",
            sqlInt($vid++),
            sqlInt($pid),
            sqlInt($did),
            sqlInt($cid),
            sqlStr($v['name_latin']),
            sqlStr($v['name_khmer'])
        );
    }
    $out[] = implode(",\n", $rows) . ";";
    $out[] = "";
}

$out[] = "SET FOREIGN_KEY_CHECKS = 1;";
$out[] = "";
$out[] = "-- ==================================================================";
$out[] = "-- Done.";
$out[] = "-- ==================================================================";

// ─────────────────────────────────────────────────────────────────────────────
// WRITE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
$sql = implode("\n", $out) . "\n";

if (SQL_OUTPUT === null) {
    echo $sql;
} else {
    if (file_put_contents(SQL_OUTPUT, $sql) === false) {
        fwrite(STDERR, "ERROR: Cannot write to " . SQL_OUTPUT . "\n"); exit(1);
    }
    echo "✓ SQL written to: " . SQL_OUTPUT . "\n";
    echo "  Provinces : " . count($provinceId)   . "\n";
    echo "  Districts : " . count($districtRows)  . "\n";
    echo "  Communes  : " . count($communeRows)   . "\n";
    echo "  Villages  : " . count($villageRows)   . "\n";
}
