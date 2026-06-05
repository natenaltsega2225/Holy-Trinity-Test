// scripts/initDB.js
const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Database schema created/updated successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error initializing DB:', err);
  process.exit(1);
});
