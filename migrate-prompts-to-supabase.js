#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

// Local PostgreSQL connection
const localPool = new Pool({
  connectionString: 'postgresql://admin:Docker4Nick@localhost:5432/forever_stories'
});

// Supabase connection
const supabasePool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migratePrompts() {
  try {
    console.log('🔄 Starting prompt migration to Supabase...\n');

    // Export prompts from local database
    console.log('📤 Exporting prompts from local PostgreSQL...');
    const exportResult = await localPool.query(`
      SELECT
        id, prompt_text, domain, story_type, emotional_weight,
        requires_gate, gate_tag, arc_step, notes, review_status,
        rating, is_core, base_weight_category, base_weight, is_active,
        created_at, updated_at, depth
      FROM prompts
      ORDER BY created_at
    `);

    const prompts = exportResult.rows;
    console.log(`✅ Exported ${prompts.length} prompts\n`);

    // Import prompts to Supabase
    console.log('📥 Importing prompts to Supabase...');
    let imported = 0;
    let skipped = 0;

    for (const prompt of prompts) {
      try {
        await supabasePool.query(`
          INSERT INTO prompts
          (id, prompt_text, domain, story_type, emotional_weight, requires_gate, gate_tag, arc_step, notes,
           review_status, rating, is_core, base_weight_category, base_weight, is_active, created_at, updated_at, depth)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (id) DO NOTHING
        `, [
          prompt.id,
          prompt.prompt_text,
          prompt.domain,
          prompt.story_type,
          prompt.emotional_weight,
          prompt.requires_gate,
          prompt.gate_tag,
          prompt.arc_step,
          prompt.notes,
          prompt.review_status,
          prompt.rating,
          prompt.is_core,
          prompt.base_weight_category,
          prompt.base_weight,
          prompt.is_active,
          prompt.created_at,
          prompt.updated_at,
          prompt.depth
        ]);
        imported++;

        if (imported % 50 === 0) {
          console.log(`  Imported ${imported}/${prompts.length} prompts...`);
        }
      } catch (error) {
        console.log(`  ⚠️  Skipped prompt: ${error.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Imported: ${imported} prompts`);
    if (skipped > 0) {
      console.log(`   Skipped: ${skipped} prompts (duplicates or errors)`);
    }

    // Verify import
    const verifyResult = await supabasePool.query('SELECT COUNT(*) as count FROM prompts');
    console.log(`\n📊 Supabase now has ${verifyResult.rows[0].count} prompts`);

    // Show sample prompts
    const sampleResult = await supabasePool.query(`
      SELECT prompt_text, domain, gate_tag
      FROM prompts
      ORDER BY created_at
      LIMIT 5
    `);

    console.log('\n📝 Sample prompts in Supabase:');
    sampleResult.rows.forEach((p, i) => {
      const text = p.prompt_text.length > 70 ? p.prompt_text.substring(0, 70) + '...' : p.prompt_text;
      const tag = p.gate_tag ? ` [${p.gate_tag}]` : '';
      console.log(`   ${i + 1}. ${text} (${p.domain})${tag}`);
    });

  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await localPool.end();
    await supabasePool.end();
  }
}

migratePrompts();
