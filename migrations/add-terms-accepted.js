require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addTermsAcceptedColumn() {
  try {
    console.log('🔧 Adding terms_accepted_at column to users table...\n');

    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name = 'terms_accepted_at'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column already exists');
    } else {
      // Add the column
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN terms_accepted_at TIMESTAMP WITH TIME ZONE
      `);
      console.log('✅ Added terms_accepted_at column');

      // Backfill existing users with their created_at timestamp
      // (assume they accepted terms when they signed up)
      const updateResult = await pool.query(`
        UPDATE users
        SET terms_accepted_at = created_at
        WHERE terms_accepted_at IS NULL
      `);
      console.log(`✅ Backfilled ${updateResult.rowCount} existing users with created_at timestamp`);
    }

    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await pool.end();
  }
}

addTermsAcceptedColumn();
