import pool from "../db.js";

export const getProvinces = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM tbl_province ORDER BY name ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

export const getDistricts = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM tbl_district WHERE province_id = ?",
      [req.params.provinceId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

export const searchPeople = async (req, res) => {
  const {
    province_id,
    district_id,
    commune_id,
    village_id,
    gender,
    givenname,
  } = req.query;

  let sql = "SELECT * FROM people WHERE 1=1";
  const params = [];

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
    params.push(`${givenname}%`);
  }

  sql += " LIMIT 100";

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
