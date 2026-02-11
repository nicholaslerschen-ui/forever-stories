const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'forever_stories',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function checkConstraints() {
  try {
    console.log('Checking all constraints on user_prompt_affinity table...\n');

    const result = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'user_prompt_affinity'::regclass
    `);

    console.log('Table constraints:');
    result.rows.forEach(row => {
      console.log(`  ${row.conname} (${row.contype}): ${row.definition}`);
    });

    console.log('\nColumn details:');
    const colResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_prompt_affinity' AND column_name IN ('domain', 'story_type', 'depth')
      ORDER BY ordinal_position
    `);

    colResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}, nullable=${row.is_nullable}, default=${row.column_default}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkConstraints();
