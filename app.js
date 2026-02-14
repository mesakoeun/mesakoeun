// server.js
import express from "express";
import pool from "./db.js"; // Import the database connection

const app = express();
const port = 3000;

// Example: Get all provinces
app.get("/api/provinces", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM tbl_province ORDER BY name ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// Example: Search people with filters
app.get("/api/search", async (req, res) => {
  // Get parameters from the URL (e.g., /api/search?province_id=1&gender=Male)
  const {
    province_id,
    district_id,
    commune_id,
    village_id,
    gender,
    givenname,
  } = req.query;

  // Base query
  let sql = "SELECT * FROM people WHERE 1=1";
  const params = [];

  // Dynamically add filters
  if (province_id) {
    sql += " AND province_id = ?";
    params.push(province_id);
  }
  if (district_id) {
    sql += " AND district_id = ?";
    params.push(district_id);
  }
  if (commune_id) {
    sql += " AND commune_id = ?";
    params.push(commune_id);
  }
  if (village_id) {
    sql += " AND village_id = ?";
    params.push(village_id);
  }
  if (gender) {
    sql += " AND gender = ?";
    params.push(gender);
  }
  if (givenname) {
    sql += " AND givenname LIKE ?";
    params.push(`${givenname}%`); // Search names starting with this string
  }

  // Performance: Always limit results on large datasets
  sql += " LIMIT 100";

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () =>
  console.log(`🚀 Server running at http://localhost:${port}`),
);
