import pool from "../db.js";

const ADMIN_CREDENTIALS = {
  admin: "admin123",
  user: "user123",
};

const normalizeDob = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();
  return text.length >= 10 ? text.slice(0, 10) : text;
};

let refreshSummaryPromise = null;

const refreshSummarySafely = async () => {
  if (!refreshSummaryPromise) {
    refreshSummaryPromise = pool.query("CALL RefreshSummary").finally(() => {
      refreshSummaryPromise = null;
    });
  }
  return refreshSummaryPromise;
};

const ensureEditHistoryTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS edit_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      person_id INT NOT NULL,
      action ENUM('INSERT','UPDATE') NOT NULL,
      old_values JSON NULL,
      new_values JSON NULL,
      changed_by VARCHAR(50) NOT NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

export const loginUser = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (ADMIN_CREDENTIALS[username] === password) {
    return res.json({
      role: username === "admin" ? "admin" : "user",
      username,
      token: Buffer.from(`${username}:${username === "admin" ? "admin" : "user"}`).toString("base64"),
    });
  }

  return res.status(401).json({ error: "Invalid credentials." });
};

export const getProvinces = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name_khmer FROM tbl_province ORDER BY id ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

export const getDistricts = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name_khmer FROM tbl_district WHERE province_id = ?",
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
      "SELECT id, name_khmer FROM tbl_commune WHERE district_id = ?",
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
      "SELECT id, name_khmer FROM tbl_village WHERE commune_id = ?",
      [req.params.commune_id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
};

export const getPersonById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.givenname, p.surname, p.gender, DATE(p.dob) AS dob,
              p.province_id, p.district_id, p.commune_id, p.village_id,
              pr.name_khmer AS province_name, d.name_khmer AS district_name,
              c.name_khmer AS commune_name, v.name_khmer AS village_name
       FROM people p
       LEFT JOIN tbl_province pr ON pr.id = p.province_id
       LEFT JOIN tbl_district d ON d.id = p.district_id
       LEFT JOIN tbl_commune c ON c.id = p.commune_id
       LEFT JOIN tbl_village v ON v.id = p.village_id
       WHERE p.id = ?`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Person not found." });
    const person = { ...rows[0], dob: normalizeDob(rows[0].dob) };
    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getPersonHistory = async (req, res) => {
  try {
    await ensureEditHistoryTable();
    const [rows] = await pool.query(
      "SELECT * FROM edit_history WHERE person_id = ? ORDER BY changed_at DESC",
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createPerson = async (req, res) => {
  try {
    if ((req.body.role || "user") !== "admin") {
      return res.status(403).json({ error: "Only admin can add people." });
    }

    const { givenname, surname, gender, dob, province_id, district_id, commune_id, village_id } = req.body;
    if (!givenname || !surname) {
      return res.status(400).json({ error: "Given name and surname are required." });
    }

    await ensureEditHistoryTable();
    const [result] = await pool.query(
      `INSERT INTO people (givenname, surname, gender, dob, province_id, district_id, commune_id, village_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [givenname, surname, gender || null, dob || null, province_id || null, district_id || null, commune_id || null, village_id || null],
    );

    const personId = result.insertId;
    await pool.query(
      "INSERT INTO edit_history (person_id, action, old_values, new_values, changed_by) VALUES (?, 'INSERT', NULL, ?, ?)",
      [personId, JSON.stringify({ id: personId, givenname, surname, gender: gender || null, dob: normalizeDob(dob), province_id, district_id, commune_id, village_id }), req.body.username || "admin"],
    );
    refreshSummarySafely().catch((refreshErr) => {
      console.error("RefreshSummary failed after create:", refreshErr);
    });
    res.status(201).json({ id: personId, message: "Person created successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePerson = async (req, res) => {
  try {
    if ((req.body.role || "user") !== "admin") {
      return res.status(403).json({ error: "Only admin can edit people." });
    }

    const [existing] = await pool.query("SELECT * FROM people WHERE id = ?", [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: "Person not found." });

    const oldData = existing[0];
    const { givenname, surname, gender, dob, province_id, district_id, commune_id, village_id } = req.body;

    const updated = {
      ...oldData,
      givenname: givenname ?? oldData.givenname,
      surname: surname ?? oldData.surname,
      gender: gender ?? oldData.gender,
      dob: dob ?? oldData.dob,
      province_id: province_id ?? oldData.province_id,
      district_id: district_id ?? oldData.district_id,
      commune_id: commune_id ?? oldData.commune_id,
      village_id: village_id ?? oldData.village_id,
    };

    await ensureEditHistoryTable();
    await pool.query(
      `UPDATE people
       SET givenname=?, surname=?, gender=?, dob=?, province_id=?, district_id=?, commune_id=?, village_id=?
       WHERE id=?`,
      [updated.givenname, updated.surname, updated.gender, updated.dob, updated.province_id, updated.district_id, updated.commune_id, updated.village_id, req.params.id],
    );
    const normalizedOldData = { ...oldData, dob: normalizeDob(oldData.dob) };
    const normalizedUpdated = { ...updated, dob: normalizeDob(updated.dob) };

    await pool.query(
      "INSERT INTO edit_history (person_id, action, old_values, new_values, changed_by) VALUES (?, 'UPDATE', ?, ?, ?)",
      [req.params.id, JSON.stringify(normalizedOldData), JSON.stringify(normalizedUpdated), req.body.username || "admin"],
    );
    refreshSummarySafely().catch((refreshErr) => {
      console.error("RefreshSummary failed after update:", refreshErr);
    });
    res.json({ message: "Person updated successfully.", person: normalizedUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const dataSql = `
      SELECT
        id,
        givenname,
        surname,
        gender,
        DATE(dob) AS dob,
        province_id,
        district_id,
        commune_id,
        village_id,
        created_at,
        updated_at
      FROM people ${whereClause}
      LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(dataSql, [...params, limit, offset]);

    const normalizedRows = rows.map((person) => ({
      ...person,
      dob: normalizeDob(person.dob),
    }));

    res.json({
      data: normalizedRows,
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
