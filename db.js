// db.js
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "192.168.122.234",
  user: "admin_people",
  password: "password123",
  database: "db_people",
  waitForConnections: true,
  connectionLimit: 10, // Adjust based on your server power
  queueLimit: 0,
});

export default pool;
