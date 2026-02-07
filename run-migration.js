require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    const sql = fs.readFileSync('./migrations/007_fix_access_grants.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 007_fix_access_grants.sql completed successfully');

    // Verify columns were added
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'access_grants'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 access_grants table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
