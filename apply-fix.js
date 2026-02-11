const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'forever_stories',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function applyFix() {
  try {
    console.log('Applying fix to user_prompt_affinity table...');
    await pool.query('ALTER TABLE user_prompt_affinity ALTER COLUMN domain DROP NOT NULL');
    console.log('✅ Fix applied successfully!');
    console.log('domain column is now nullable, allowing separate story_type and depth affinity tracking');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying fix:', error.message);
    await pool.end();
    process.exit(1);
  }
}

applyFix();
