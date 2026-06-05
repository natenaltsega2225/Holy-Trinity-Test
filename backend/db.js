


// db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "holy_trinity",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false, // ✅ safer
  // You can also enable SSL if using remote DB:
  // ssl: process.env.DB_SSL === "1" ? { rejectUnauthorized: true } : undefined,
});

(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log("✅ Database connection OK");
  } catch (err) {
    console.error("❌ Database connection FAILED:", err.code, err.message);
  }
})();

module.exports = pool;