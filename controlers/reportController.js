import pool from "../db.js";

export const getDemographicReport = async (req, res) => {
  const { province_id, district_id, commune_id, age_from, age_to, gender } =
    req.query;

  let groupByCol = "";
  let joinTable = "";
  let joinCondition = "";
  let nameCol = "";
  let whereClause = " WHERE 1=1";
  const params = [];
  if (gender && gender !== "") {
    // The summary table has a 'gender' column, so we just filter by it
    whereClause += " AND s.gender = ?";
    params.push(gender);
  }
  // --- 1. Determine Hierarchy (Same as before) ---
  if (commune_id) {
    groupByCol = "s.village_id";
    joinTable = "tbl_village";
    joinCondition = "s.village_id = loc.id";
    nameCol = "Village Name";
    whereClause += " AND s.commune_id = ?";
    params.push(commune_id);
  } else if (district_id) {
    groupByCol = "s.commune_id";
    joinTable = "tbl_commune";
    joinCondition = "s.commune_id = loc.id";
    nameCol = "Commune Name";
    whereClause += " AND s.district_id = ?";
    params.push(district_id);
  } else if (province_id) {
    groupByCol = "s.district_id";
    joinTable = "tbl_district";
    joinCondition = "s.district_id = loc.id";
    nameCol = "District Name";
    whereClause += " AND s.province_id = ?";
    params.push(province_id);
  } else {
    groupByCol = "s.province_id";
    joinTable = "tbl_province";
    joinCondition = "s.province_id = loc.id";
    nameCol = "Province Name";
  }

  // Ensure the summary cache is current before querying the report.
  await pool.query("CALL RefreshSummary()");

  // --- 2. Dynamic Pivot Columns (Optimized) ---
  let selectColumns = `loc.name_khmer AS location_name`;
  const currentYear = new Date().getFullYear();

  if (age_from && age_to) {
    const start = parseInt(age_from);
    const end = parseInt(age_to);

    for (let age = start; age <= end; age++) {
      // Calculate the target birth year for this age
      const targetYear = currentYear - age;
      let headers = ["No", nameCol];

      // OPTIMIZATION: We sum the pre-calculated 'total_people' column
      // instead of counting raw rows.
      selectColumns += `, 
            COALESCE(SUM(CASE WHEN s.birth_year = ${targetYear} THEN s.total_people ELSE 0 END), 0) AS 'Age ${age}'`;
      headers.push(`Age ${age}`);
    }
  } else {
    selectColumns += `, 
        COALESCE(SUM(CASE WHEN s.gender = 'Male' THEN s.total_people ELSE 0 END), 0) AS 'Male',
        COALESCE(SUM(CASE WHEN s.gender = 'Female' THEN s.total_people ELSE 0 END), 0) AS 'Female',
        COALESCE(SUM(s.total_people), 0) AS 'Total'`;
  }

  // --- 3. Query the SUMMARY Table ---
  // Notice we select from 'summary_demographics' (aliased as 's')
  const sql = `
        SELECT ${selectColumns}
        FROM summary_demographics s
        JOIN ${joinTable} loc ON ${joinCondition}
        ${whereClause}
        GROUP BY ${groupByCol}, loc.name_khmer
        ORDER BY loc.name_khmer ASC
    `;

  try {
    const [rows] = await pool.query(sql, params);

    // Return formatting (Headers logic stays same)
    const headers = ["No", nameCol];
    if (age_from && age_to) {
      const start = parseInt(age_from);
      const end = parseInt(age_to);
      for (let i = start; i <= end; i++) headers.push(`Age ${i}`);
    } else {
      headers.push("Male", "Female", "Total");
    }

    res.json({ headers, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
