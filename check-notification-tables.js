// Quick script to check if notification tables exist
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTables() {
  try {
    console.log('Checking notification tables...\n');

    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('push_tokens', 'notification_preferences', 'notification_log')
      ORDER BY table_name
    `);

    console.log('📊 Tables found:', tables.rows.map(r => r.table_name));

    if (tables.rows.length === 0) {
      console.log('\n❌ No notification tables found! Run migration 007 first.');
      process.exit(1);
    }

    // Check notification_preferences columns
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'notification_preferences'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 notification_preferences columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Check if any users have preferences
    const userCount = await pool.query('SELECT COUNT(*) FROM notification_preferences');
    console.log(`\n👥 Users with preferences: ${userCount.rows[0].count}`);

    // If no preferences, show sample user IDs
    if (userCount.rows[0].count === '0') {
      const users = await pool.query('SELECT id, email FROM users LIMIT 3');
      console.log('\n⚠️  No users have notification preferences yet.');
      console.log('Sample user IDs:');
      users.rows.forEach(u => console.log(`  - ${u.id} (${u.email})`));
    }

    console.log('\n✅ Check complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
