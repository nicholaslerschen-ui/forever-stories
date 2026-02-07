// Run migration 008 - Add invite notifications preference
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    console.log('Running migration 008: Add invite notifications preference...');

    // Add invites_enabled column
    await pool.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS invites_enabled BOOLEAN DEFAULT TRUE;
    `);

    console.log('✅ Migration completed successfully!');
    console.log('   - Added invites_enabled column to notification_preferences table');

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'notification_preferences' AND column_name = 'invites_enabled';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log('   ', result.rows[0]);
    } else {
      console.log('⚠️  Warning: Could not verify column was added');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
