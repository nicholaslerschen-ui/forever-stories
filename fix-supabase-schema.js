const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.dwdeqxygemgjutlmuxdn:Supabase4Nick@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function applyFix() {
  try {
    console.log('Connecting to Supabase database...');

    // Check current schema
    console.log('\n1. Checking current domain column schema...');
    const checkResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_prompt_affinity' AND column_name = 'domain'
    `);

    if (checkResult.rows.length > 0) {
      console.log('Current domain column:', checkResult.rows[0]);

      if (checkResult.rows[0].is_nullable === 'NO') {
        console.log('\n2. Applying ALTER TABLE to make domain nullable...');
        await pool.query('ALTER TABLE user_prompt_affinity ALTER COLUMN domain DROP NOT NULL');
        console.log('✅ ALTER TABLE completed successfully!');

        // Verify the change
        const verifyResult = await pool.query(`
          SELECT column_name, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'user_prompt_affinity' AND column_name = 'domain'
        `);
        console.log('\n3. Verification - domain column is now:', verifyResult.rows[0]);
      } else {
        console.log('✅ Domain column is already nullable!');
      }
    } else {
      console.log('❌ user_prompt_affinity table or domain column not found');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detail:', error.detail);
    await pool.end();
    process.exit(1);
  }
}

applyFix();
