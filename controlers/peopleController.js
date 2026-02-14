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
      [req.params.province_id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};
export const getCommunes = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM tbl_commune WHERE district_id = ?",
      [req.params.district_id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};
export const getVillages = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name FROM tbl_village WHERE commune_id = ?",
      [req.params.commune_id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

export const searchPeople = async (req, res) => {
  const {
    givenname,
    surname,
    gender,
    province_id,
    district_id,
    commune_id,
    village_id,
    age_from,
    age_to,
    page = 1,
  } = req.query;

  const limit = 100; // Records per page
  const offset = (page - 1) * limit;

  let whereClause = " WHERE 1=1";
  const params = [];
  if (givenname && givenname.trim() !== "") {
    whereClause += " AND TRIM(givenname) = ?";
    params.push(givenname.trim());
  }
  if (surname && surname.trim() !== "") {
    whereClause += " AND TRIM(surname) = ?";
    params.push(surname.trim());
  }
  if (gender && gender.trim().length > 0) {
    whereClause += " AND gender = ?";
    params.push(gender);
  }
  if (province_id) {
    whereClause += " AND province_id = ?";
    params.push(province_id);
  }
  if (district_id) {
    whereClause += " AND district_id = ?";
    params.push(district_id);
  }
  if (commune_id) {
    whereClause += " AND commune_id = ?";
    params.push(commune_id);
  }
  if (village_id) {
    whereClause += " AND village_id = ?";
    params.push(village_id);
  }
  if (age_from || age_to) {
    const currentYear = new Date().getFullYear();
    if (age_from) {
      // If age_from is 18, they must be born on or BEFORE (2026 - 18)
      const yearFrom = currentYear - parseInt(age_from);
      whereClause += " AND dob <= ?";
      params.push(`${yearFrom}-12-31`);
    }
    if (age_to) {
      // If age_to is 50, they must be born on or AFTER (2026 - 50)
      const yearTo = currentYear - parseInt(age_to);
      whereClause += " AND dob >= ?";
      params.push(`${yearTo}-01-01`);
    }
  }
  try {
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM people ${whereClause}`,
      params,
    );
    const totalRecords = countResult[0].total;

    const dataSql = `SELECT * FROM people ${whereClause} LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    res.json({
      data: rows,
      pagination: {
        totalRecords,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
