// Run migration 009 - Add notification cooldown tracking
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
    console.log('Running migration 009: Add notification cooldown tracking...');

    // Add cooldown tracking columns
    await pool.query(`
      ALTER TABLE notification_preferences
      ADD COLUMN IF NOT EXISTS consecutive_skips INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS in_cooldown BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS final_reminder_sent BOOLEAN DEFAULT FALSE;
    `);

    console.log('✅ Migration completed successfully!');
    console.log('   - Added consecutive_skips column');
    console.log('   - Added last_reminder_sent_at column');
    console.log('   - Added in_cooldown column');
    console.log('   - Added cooldown_until column');
    console.log('   - Added final_reminder_sent column');

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'notification_preferences'
      AND column_name IN ('consecutive_skips', 'last_reminder_sent_at', 'in_cooldown', 'cooldown_until', 'final_reminder_sent')
      ORDER BY column_name;
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verification successful:');
      result.rows.forEach(row => console.log('   ', row));
    } else {
      console.log('⚠️  Warning: Could not verify columns were added');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
