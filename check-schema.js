require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'access_grants'
      ORDER BY ordinal_position
    `);

    console.log('\naccess_grants columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
