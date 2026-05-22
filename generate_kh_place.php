<?php
/**
 * generate_kh_places_sql.php
 *
 * Reads kh-places.csv and generates SQL INSERT statements for:
 *   tbl_province  — province level
 *   tbl_district  — district / city (ស្រុក / ក្រុង)
 *   tbl_commune   — commune / sangkat (ឃុំ / សង្កាត់)
 *   tbl_village   — village (ភូមិ)
 *
 * Schema uses auto-increment PKs and FK relationships by ID.
 * Each table stores name_latin + name_khmer from the CSV.
 *
 * Code hierarchy in the CSV:
 *   Province  → 1 digit    e.g. 1
 *   District  → 3 digits   e.g. 102  (province code = code[0])
 *   Commune   → 5 digits   e.g. 10201 (district code = code[0..2])
 *   Village   → 7 digits   e.g. 1020101 (commune code = code[0..4])
 *
 * Usage:
 *   php generate_kh_places_sql.php
 *   php generate_kh_places_sql.php > output.sql
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
define('CSV_FILE',   __DIR__ . '/kh-places.csv');
define('SQL_OUTPUT', __DIR__ . '/kh-places-insert.sql'); // null = stdout

// Province rows (not in CSV — hardcoded by province code prefix).
// Add more entries here if your CSV covers multiple provinces.
$PROVINCES = [
'1'=> ['name_latin' => 'Banteay Meanchey', 'name_khmer' => 'ខេត្តបន្ទាយមានជ័យ'],
'2'=> ['name_latin' => 'Battambang', 'name_khmer' => 'ខេត្តបាត់ដំបង'],
'3'=> ['name_latin' => 'Kampong Cham', 'name_khmer' => 'ខេត្តកំពង់ចាម'],
'4'=> ['name_latin' => 'Kampong Chhnang', 'name_khmer' => 'ខេត្តកំពង់ឆ្នាំង'],
'5'=> ['name_latin' => 'Kampong Speu', 'name_khmer' => 'ខេត្តកំពង់ស្ពឺ'],
'6'=> ['name_latin' => 'Kampong Thom', 'name_khmer' => 'ខេត្តកំពង់ធំ'],
'7'=> ['name_latin' => 'Kampot', 'name_khmer' => 'ខេត្តកំពត'],
'8'=> ['name_latin' => 'Kandal', 'name_khmer' => 'ខេត្តកណ្ដាល'],
'9'=> ['name_latin' => 'Koh Kong', 'name_khmer' => 'ខេត្តកោះកុង'],
'10'=> ['name_latin' => 'Kratie', 'name_khmer' => 'ខេត្តក្រចេះ'],
'11'=> ['name_latin' => 'Mondul Kiri', 'name_khmer' => 'ខេត្តមណ្ឌលគិរី'],
'12'=> ['name_latin' => 'Phnom Penh Capital', 'name_khmer' => 'រាជធានីភ្នំពេញ'],
'13'=> ['name_latin' => 'Preah Vihear', 'name_khmer' => 'ខេត្តព្រះវិហារ'],
'14'=> ['name_latin' => 'Prey Veng', 'name_khmer' => 'ខេត្តព្រៃវែង'],
'15'=> ['name_latin' => 'Pursat', 'name_khmer' => 'ខេត្តពោធិ៍សាត់'],
'16'=> ['name_latin' => 'Ratanak Kiri', 'name_khmer' => 'ខេត្តរតនគិរី'],
'17'=> ['name_latin' => 'Siemreap', 'name_khmer' => 'ខេត្តសៀមរាប'],
'18'=> ['name_latin' => 'Preah Sihanouk', 'name_khmer' => 'ខេត្តព្រះសីហនុ'],
'19'=> ['name_latin' => 'Stung Treng', 'name_khmer' => 'ខេត្តស្ទឹងត្រែង'],
'20'=> ['name_latin' => 'Svay Rieng', 'name_khmer' => 'ខេត្តស្វាយរៀង'],
'21'=> ['name_latin' => 'Takeo', 'name_khmer' => 'ខេត្តតាកែវ'],
'22'=> ['name_latin' => 'Oddar Meanchey', 'name_khmer' => 'ខេត្តឧត្ដរមានជ័យ'],
'23'=> ['name_latin' => 'Kep', 'name_khmer' => 'ខេត្តកែប'],
'24'=> ['name_latin' => 'Pailin', 'name_khmer' => 'ខេត្តប៉ៃលិន'],
'25'=> ['name_latin' => 'Tboung Khmum', 'name_khmer' => 'ខេត្តត្បូងឃ្មុំ'],
    
];

// Khmer type labels
const TYPE_DISTRICT = 'ស្រុក';
const TYPE_CITY     = 'ក្រុង';
const TYPE_COMMUNE  = 'ឃុំ';
const TYPE_SANGKAT  = 'សង្កាត់';
const TYPE_VILLAGE  = 'ភូមិ';

// INSERT batch size for villages (keeps file readable)
const VILLAGE_BATCH = 500;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function sqlStr(?string $v): string
{
    if ($v === null || $v === '') return 'NULL';
    return "'" . str_replace(["\\", "'"], ["\\\\", "\\'"], $v) . "'";
}

function sqlInt(?int $v): string
{
    return $v === null ? 'NULL' : (string)$v;
}

function provinceKey(string $districtCode): string { return substr($districtCode, 0, 1); }
function districtKey(string $communeCode):  string { return substr($communeCode,  0, 3); }
function communeKey(string  $villageCode):  string { return substr($villageCode,  0, 5); }

// ─────────────────────────────────────────────────────────────────────────────
// READ CSV
// ─────────────────────────────────────────────────────────────────────────────
if (!file_exists(CSV_FILE)) {
    fwrite(STDERR, "ERROR: CSV not found at " . CSV_FILE . "\n"); exit(1);
}

$handle = fopen(CSV_FILE, 'r');
if (!$handle) {
    fwrite(STDERR, "ERROR: Cannot open CSV.\n"); exit(1);
}

// Header — strip UTF-8 BOM if present
$header = fgetcsv($handle);
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

$line = 1;
while (($row = fgetcsv($handle)) !== false) {
    $line++;
    if (count($row) < 4) continue;

    $type  = trim($row[$iType]);
    $code  = trim($row[$iCode]);
    $khmer = trim($row[$iKhmer]);
    $latin = trim($row[$iLatin]);

    if ($code === '') continue;

    switch ($type) {
        case TYPE_DISTRICT:
        case TYPE_CITY:
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
            fwrite(STDERR, "WARNING line {$line}: unknown type '{$type}' skipped.\n");
    }
}
fclose($handle);

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGN AUTO-INCREMENT IDs
// Maps: province_code → id, district_code → id, commune_code → id
// ─────────────────────────────────────────────────────────────────────────────
$provinceId = [];
$districtId = [];
$communeId  = [];

$pid = 1;
foreach ($PROVINCES as $key => $prov) {
    $provinceId[$key] = $pid++;
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
$lines = [];

$lines[] = "-- ================================================================";
$lines[] = "-- Cambodia Places — INSERT Statements";
$lines[] = "-- Generated : " . date('Y-m-d H:i:s');
$lines[] = "-- Schema    : tbl_province, tbl_district, tbl_commune, tbl_village";
$lines[] = "-- ================================================================";
$lines[] = "";
$lines[] = "SET NAMES utf8mb4;";
$lines[] = "SET CHARACTER SET utf8mb4;";
$lines[] = "SET FOREIGN_KEY_CHECKS = 0;";
$lines[] = "";

// ── tbl_province ─────────────────────────────────────────────────────────────
$lines[] = "-- ----------------------------------------------------------------";
$lines[] = "-- tbl_province";
$lines[] = "-- ----------------------------------------------------------------";
$lines[] = "INSERT INTO `tbl_province` (`id`, `name_latin`, `name_khmer`) VALUES";
$rows = [];
foreach ($PROVINCES as $key => $p) {
    $rows[] = sprintf("  (%s, %s, %s)",
        sqlInt($provinceId[$key]),
        sqlStr($p['name_latin']),
        sqlStr($p['name_khmer'])
    );
}
$lines[] = implode(",\n", $rows) . ";";
$lines[] = "";

// ── tbl_district ─────────────────────────────────────────────────────────────
$lines[] = "-- ----------------------------------------------------------------";
$lines[] = "-- tbl_district  (" . count($districtRows) . " rows)";
$lines[] = "-- ----------------------------------------------------------------";
$lines[] = "INSERT INTO `tbl_district` (`id`, `province_id`, `name_latin`, `name_khmer`) VALUES";
$rows = [];
foreach ($districtRows as $code => $d) {
    $pKey = $d['province_key'];
    $pid  = $provinceId[$pKey] ?? null;
    if ($pid === null) {
        fwrite(STDERR, "WARNING: No province found for district code {$code} (key={$pKey}).\n");
    }
    $rows[] = sprintf("  (%s, %s, %s, %s)",
        sqlInt($districtId[$code]),
        sqlInt($pid),
        sqlStr($d['name_latin']),
        sqlStr($d['name_khmer'])
    );
}
$lines[] = implode(",\n", $rows) . ";";
$lines[] = "";

// ── tbl_commune ──────────────────────────────────────────────────────────────
$lines[] = "-- ----------------------------------------------------------------";
$lines[] = "-- tbl_commune  (" . count($communeRows) . " rows)";
$lines[] = "-- ----------------------------------------------------------------";
$lines[] = "INSERT INTO `tbl_commune` (`id`, `province_id`, `district_id`, `name_latin`, `name_khmer`) VALUES";
$rows = [];
foreach ($communeRows as $code => $c) {
    $dKey = $c['district_key'];
    $did  = $districtId[$dKey] ?? null;

    // Resolve province via district's province key
    $dRow = $districtRows[$dKey] ?? null;
    $pKey = $dRow ? $dRow['province_key'] : null;
    $pid  = $pKey ? ($provinceId[$pKey] ?? null) : null;

    if ($did === null) {
        fwrite(STDERR, "WARNING: No district found for commune {$code} (district key={$dKey}).\n");
    }

    $rows[] = sprintf("  (%s, %s, %s, %s, %s)",
        sqlInt($communeId[$code]),
        sqlInt($pid),
        sqlInt($did),
        sqlStr($c['name_latin']),
        sqlStr($c['name_khmer'])
    );
}
$lines[] = implode(",\n", $rows) . ";";
$lines[] = "";

// ── tbl_village ──────────────────────────────────────────────────────────────
$lines[] = "-- ----------------------------------------------------------------";
$lines[] = "-- tbl_village  (" . count($villageRows) . " rows — batches of " . VILLAGE_BATCH . ")";
$lines[] = "-- ----------------------------------------------------------------";

$vid     = 1;
$batches = array_chunk(array_values($villageRows), VILLAGE_BATCH);

foreach ($batches as $batch) {
    $lines[] = "INSERT INTO `tbl_village` (`id`, `province_id`, `district_id`, `commune_id`, `name_latin`, `name_khmer`) VALUES";
    $rows = [];
    foreach ($batch as $v) {
        $cKey = $v['commune_key'];
        $cid  = $communeId[$cKey] ?? null;

        // Resolve district and province via commune → district chain
        $cRow = $communeRows[$cKey] ?? null;
        $dKey = $cRow ? $cRow['district_key'] : null;
        $did  = $dKey ? ($districtId[$dKey] ?? null) : null;

        $dRow = $dKey ? ($districtRows[$dKey] ?? null) : null;
        $pKey = $dRow ? $dRow['province_key'] : null;
        $pid  = $pKey ? ($provinceId[$pKey] ?? null) : null;

        if ($cid === null) {
            fwrite(STDERR, "WARNING: No commune found for village {$v['code']} (commune key={$cKey}).\n");
        }

        $rows[] = sprintf("  (%s, %s, %s, %s, %s, %s)",
            sqlInt($vid++),
            sqlInt($pid),
            sqlInt($did),
            sqlInt($cid),
            sqlStr($v['name_latin']),
            sqlStr($v['name_khmer'])
        );
    }
    $lines[] = implode(",\n", $rows) . ";";
    $lines[] = "";
}

$lines[] = "SET FOREIGN_KEY_CHECKS = 1;";
$lines[] = "";
$lines[] = "-- ================================================================";
$lines[] = "-- Summary";
$lines[] = "-- Provinces : " . count($PROVINCES);
$lines[] = "-- Districts : " . count($districtRows);
$lines[] = "-- Communes  : " . count($communeRows);
$lines[] = "-- Villages  : " . count($villageRows);
$lines[] = "-- ================================================================";

// ─────────────────────────────────────────────────────────────────────────────
// WRITE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
$sql = implode("\n", $lines) . "\n";

if (SQL_OUTPUT === null) {
    echo $sql;
} else {
    if (file_put_contents(SQL_OUTPUT, $sql) === false) {
        fwrite(STDERR, "ERROR: Could not write " . SQL_OUTPUT . "\n"); exit(1);
    }
    echo "✓ SQL written to: " . SQL_OUTPUT . "\n";
    echo "  Provinces : " . count($PROVINCES)   . "\n";
    echo "  Districts : " . count($districtRows) . "\n";
    echo "  Communes  : " . count($communeRows)  . "\n";
    echo "  Villages  : " . count($villageRows)  . "\n";
}
