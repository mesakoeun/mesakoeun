import { faker } from "@faker-js/faker";
import mysql from "mysql2/promise";

async function seedLargeScale() {
  // 1. Connection Pool (Better for high-volume inserts)
  const pool = mysql.createPool({
    host: "192.168.2.129",
    user: "admin_people", // Replace with your MariaDB username
    password: "password123", // Replace with your password
    database: "db_people", // Replace with your database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const TOTAL_RECORDS = 2000000;
  const BATCH_SIZE = 10000;
  const currentYear = new Date().getFullYear();

  console.log(
    `🚀 Starting bulk insert of ${TOTAL_RECORDS.toLocaleString()} records...`,
  );
  console.time("TotalExecutionTime");

  try {
    for (let i = 0; i < TOTAL_RECORDS / BATCH_SIZE; i++) {
      const values = [];

      for (let j = 0; j < BATCH_SIZE; j++) {
        // Logic: Age 15-80
        const age = faker.number.int({ min: 15, max: 80 });
        const birthYear = currentYear - age;

        // Format: YYYY-MM-DD
        const month = String(faker.number.int({ min: 1, max: 12 })).padStart(
          2,
          "0",
        );
        const day = String(faker.number.int({ min: 1, max: 28 })).padStart(
          2,
          "0",
        );
        const dob = `${birthYear}-${month}-${day}`;

        values.push([
          faker.person.firstName(),
          faker.person.lastName(),
          faker.helpers.arrayElement(["Male", "Female"]),
          dob,
          faker.number.int({ min: 1, max: 25 }), // province_id
          null, // district_id
          null, // commune_id
          null, // village_id
        ]);
      }

      // Execute Batch Insert
      const sql =
        "INSERT INTO people (givenname, surname, gender, dob, province_id, district_id, commune_id, village_id) VALUES ?";
      await pool.query(sql, [values]);

      // Progress tracking
      if ((i + 1) % 10 === 0) {
        const completed = (i + 1) * BATCH_SIZE;
        const percentage = ((completed / TOTAL_RECORDS) * 100).toFixed(1);
        console.log(
          `✅ Progress: ${completed.toLocaleString()} records (${percentage}%)`,
        );
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
