const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Starting migration: Adding response_files table...');

    // Create response_files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS response_files (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        response_id UUID REFERENCES prompt_responses(id) ON DELETE CASCADE,
        file_id UUID REFERENCES user_files(id) ON DELETE CASCADE,
        display_order INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(response_id, file_id)
      );
    `);
    console.log('✓ Created response_files table');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_response_files_response
      ON response_files(response_id);
    `);
    console.log('✓ Created index idx_response_files_response');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_response_files_file
      ON response_files(file_id);
    `);
    console.log('✓ Created index idx_response_files_file');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
