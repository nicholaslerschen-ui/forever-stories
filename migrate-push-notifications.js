#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Supabase connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migratePushNotifications() {
  try {
    console.log('🔄 Starting push notifications migration...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '007-push-notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📤 Running migration SQL...');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration complete!\n');

    // Verify tables were created
    const verifyTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('push_tokens', 'notification_preferences', 'notification_log')
      ORDER BY table_name
    `);

    console.log('📊 Created tables:');
    verifyTables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check notification preferences were seeded
    const prefCount = await pool.query('SELECT COUNT(*) as count FROM notification_preferences');
    console.log(`\n📝 ${prefCount.rows[0].count} users have notification preferences`);

  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migratePushNotifications();
