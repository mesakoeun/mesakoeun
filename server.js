import { faker } from "@faker-js/faker";
import mysql from "mysql2/promise";

async function seedLargeScale() {
  // 1. Connection Pool
  const pool = mysql.createPool({
    host: "192.168.122.234",
    user: "admin_people",
    password: "password123",
    database: "db_people",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const TOTAL_RECORDS = 2000000;
  const BATCH_SIZE = 10000;
  const currentYear = new Date().getFullYear();

  console.log(`🚀 Starting bulk insert of ${TOTAL_RECORDS.toLocaleString()} records...`);
  console.time("TotalExecutionTime");

  try {
    // Pre-load location data for hierarchical random selection
    console.log("📍 Loading location hierarchies...");

    // Get all provinces
    const [provinces] = await pool.query("SELECT id FROM tbl_province");
    const provinceIds = provinces.map(p => p.id);

    // Get districts with province_id
    const [districts] = await pool.query("SELECT id, province_id FROM tbl_district");
    const districtMap = new Map(); // province_id -> list of district ids
    districts.forEach(d => {
      if (!districtMap.has(d.province_id)) districtMap.set(d.province_id, []);
      districtMap.get(d.province_id).push(d.id);
    });

    // Get communes with district_id
    const [communes] = await pool.query("SELECT id, district_id FROM tbl_commune");
    const communeMap = new Map(); // district_id -> list of commune ids
    communes.forEach(c => {
      if (!communeMap.has(c.district_id)) communeMap.set(c.district_id, []);
      communeMap.get(c.district_id).push(c.id);
    });

    // Get villages with commune_id
    const [villages] = await pool.query("SELECT id, commune_id FROM tbl_village");
    const villageMap = new Map(); // commune_id -> list of village ids
    villages.forEach(v => {
      if (!villageMap.has(v.commune_id)) villageMap.set(v.commune_id, []);
      villageMap.get(v.commune_id).push(v.id);
    });

    console.log(`✅ Loaded: ${provinceIds.length} provinces, ${districts.length} districts, ${communes.length} communes, ${villages.length} villages`);

    for (let i = 0; i < TOTAL_RECORDS / BATCH_SIZE; i++) {
      const values = [];

      for (let j = 0; j < BATCH_SIZE; j++) {
        // Age 15-80
        const age = faker.number.int({ min: 15, max: 80 });
        const birthYear = currentYear - age;

        // DOB YYYY-MM-DD
        const month = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
        const day = String(faker.number.int({ min: 1, max: 28 })).padStart(2, "0");
        const dob = `${birthYear}-${month}-${day}`;

        // Hierarchical random location
        const province_id = faker.helpers.arrayElement(provinceIds);
        
        let district_id = null;
        let commune_id = null;
        let village_id = null;

        const districtList = districtMap.get(province_id);
        if (districtList && districtList.length > 0) {
          district_id = faker.helpers.arrayElement(districtList);
          
          const communeList = communeMap.get(district_id);
          if (communeList && communeList.length > 0) {
            commune_id = faker.helpers.arrayElement(communeList);
            
            const villageList = villageMap.get(commune_id);
            if (villageList && villageList.length > 0) {
              village_id = faker.helpers.arrayElement(villageList);
            }
          }
        }

        values.push([
          faker.person.firstName(),
          faker.person.lastName(),
          faker.helpers.arrayElement(["Male", "Female"]),
          dob,
          province_id,
          district_id,
          commune_id,
          village_id,
        ]);
      }

      // Execute Batch Insert
      const sql = `
        INSERT INTO people 
        (givenname, surname, gender, dob, province_id, district_id, commune_id, village_id) 
        VALUES ?
      `;
      await pool.query(sql, [values]);

      // Progress tracking
      if ((i + 1) % 10 === 0) {
        const completed = (i + 1) * BATCH_SIZE;
        const percentage = ((completed / TOTAL_RECORDS) * 100).toFixed(1);
        console.log(`✅ Progress: ${completed.toLocaleString()} records (${percentage}%)`);
      }
    }

    console.log("\n✨ Success! 2 Million records inserted.");
    console.timeEnd("TotalExecutionTime");
  } catch (error) {
    console.error("❌ Critical Error during seeding:", error);
  } finally {
    await pool.end();
  }
}

seedLargeScale();