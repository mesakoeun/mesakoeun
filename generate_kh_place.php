<?php
/**
 * generate_kh_places_sql.php
 *
 * Reads the full national kh-places.csv (all 25 provinces) and generates
 * correct SQL INSERTs for tbl_province, tbl_district, tbl_commune, tbl_village.
 *
 * Fixed: Uses actual geographic codes as Primary Keys to prevent duplicate reference breaks.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
define('CSV_FILE',   __DIR__ . '/kh-places.csv');
define('SQL_OUTPUT', __DIR__ . '/kh-places-insert.sql'); 

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

const TYPE_DISTRICT = 'ស្រុក';
const TYPE_CITY     = 'ក្រុង';
const TYPE_KHAN     = 'ខណ្ឌ';   
const TYPE_COMMUNE  = 'ឃុំ';
const TYPE_SANGKAT  = 'សង្កាត់';
const TYPE_VILLAGE  = 'ភូមិ';

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

function provinceKey(string $code): string
{
    return strlen($code) === 3 ? '0' . $code[0] : substr($code, 0, 2);
}

function districtKey(string $code): string
{
    return strlen($code) === 5 ? substr($code, 0, 3) : substr($code, 0, 4);
}

function communeKey(string $code): string
{
    return strlen($code) === 7 ? substr($code, 0, 5) : substr($code, 0, 6);
}

function buildBatches(array $rows, int $size): array
{
    return array_chunk(array_values($rows), $size);
}

// ─────────────────────────────────────────────────────────────────────────────
// READ & PARSE
// ─────────────────────────────────────────────────────────────────────────────
if (!file_exists(CSV_FILE)) { fwrite(STDERR, "ERROR: CSV not found.\n"); exit(1); }
$handle = fopen(CSV_FILE, 'r');
if (!$handle)               { fwrite(STDERR, "ERROR: Cannot open CSV.\n"); exit(1); }

$header = fgetcsv($handle);
if (isset($header[0])) $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);

$colMap = [];
foreach ($header as $i => $col) $colMap[trim($col)] = $i;

$iType  = $colMap['Type'];
$iCode  = $colMap['Code'];
$iKhmer = $colMap['Name (Khmer)'];
$iLatin = $colMap['Name (Latin)'];

$districtRows = [];
$communeRows  = [];
$villageRows  = [];
$usedProvinceCodes = [];

while (($row = fgetcsv($handle)) !== false) {
    if (count($row) < 4) continue;

    $type  = trim($row[$iType]);
    $code  = trim($row[$iCode]);
    $khmer = trim($row[$iKhmer]);
    $latin = trim($row[$iLatin]);

    if ($code === '') continue;

    switch ($type) {
        case TYPE_DISTRICT:
        case TYPE_CITY:
        case TYPE_KHAN:
            $pKey = provinceKey($code);
            $usedProvinceCodes[$pKey] = true;
            $districtRows[$code] = [
                'code'         => (int)$code,
                'province_id'  => (int)$pKey,
                'name_latin'   => $latin,
                'name_khmer'   => $khmer,
            ];
            break;

        case TYPE_COMMUNE:
        case TYPE_SANGKAT:
            $dKey = districtKey($code);
            $pKey = provinceKey($dKey);
            $communeRows[$code] = [
                'code'         => (int)$code,
                'province_id'  => (int)$pKey,
                'district_id'  => (int)$dKey,
                'name_latin'   => $latin,
                'name_khmer'   => $khmer,
            ];
            break;

        case TYPE_VILLAGE:
            $cKey = communeKey($code);
            $dKey = districtKey($cKey);
            $pKey = provinceKey($dKey);
            $villageRows[$code] = [
                'code'         => (int)$code,
                'province_id'  => (int)$pKey,
                'district_id'  => (int)$dKey,
                'commune_id'   => (int)$cKey,
                'name_latin'   => $latin,
                'name_khmer'   => $khmer,
            ];
            break;
    }
}
fclose($handle);

ksort($usedProvinceCodes);

// ─────────────────────────────────────────────────────────────────────────────
// BUILD SQL EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
$out = [];
$out[] = "SET NAMES utf8mb4;";
$out[] = "SET CHARACTER SET utf8mb4;";
$out[] = "SET FOREIGN_KEY_CHECKS = 0;\n";

// ── tbl_province ─────────────────────────────────────────────────────────────
$out[] = "INSERT INTO `tbl_province` (`id`, `name_latin`, `name_khmer`) VALUES";
$pRows = [];
foreach (array_keys($usedProvinceCodes) as $pCode) {
    $pData = $PROVINCES[$pCode] ?? ['name_latin' => "Province {$pCode}", 'name_khmer' => ''];
    $pRows[] = sprintf("  (%d, %s, %s)", (int)$pCode, sqlStr($pData['name_latin']), sqlStr($pData['name_khmer']));
}
$out[] = implode(",\n", $pRows) . ";\n";

// ── tbl_district ─────────────────────────────────────────────────────────────
foreach (buildBatches($districtRows, BATCH_SIZE) as $batch) {
    $out[] = "INSERT INTO `tbl_district` (`id`, `province_id`, `name_latin`, `name_khmer`) VALUES";
    $dRows = [];
    foreach ($batch as $d) {
        $dRows[] = sprintf("  (%d, %d, %s, %s)", $d['code'], $d['province_id'], sqlStr($d['name_latin']), sqlStr($d['name_khmer']));
    }
    $out[] = implode(",\n", $dRows) . ";\n";
}

// ── tbl_commune ──────────────────────────────────────────────────────────────
foreach (buildBatches($communeRows, BATCH_SIZE) as $batch) {
    $out[] = "INSERT INTO `tbl_commune` (`id`, `province_id`, `district_id`, `name_latin`, `name_khmer`) VALUES";
    $cRows = [];
    foreach ($batch as $c) {
        $cRows[] = sprintf("  (%d, %d, %d, %s, %s)", $c['code'], $c['province_id'], $c['district_id'], sqlStr($c['name_latin']), sqlStr($c['name_khmer']));
    }
    $out[] = implode(",\n", $cRows) . ";\n";
}

// ── tbl_village ──────────────────────────────────────────────────────────────
foreach (buildBatches($villageRows, BATCH_SIZE) as $batch) {
    $out[] = "INSERT INTO `tbl_village` (`id`, `province_id`, `district_id`, `commune_id`, `name_latin`, `name_khmer`) VALUES";
    $vRows = [];
    foreach ($batch as $v) {
        $vRows[] = sprintf("  (%d, %d, %d, %d, %s, %s)", $v['code'], $v['province_id'], $v['district_id'], $v['commune_id'], sqlStr($v['name_latin']), sqlStr($v['name_khmer']));
    }
    $out[] = implode(",\n", $vRows) . ";\n";
}

$out[] = "SET FOREIGN_KEY_CHECKS = 1;";

file_put_contents(SQL_OUTPUT, implode("\n", $out));
echo "✓ Direct Geocode-mapped SQL successfully written to: " . SQL_OUTPUT . "\n";