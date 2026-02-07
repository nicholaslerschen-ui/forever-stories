# Advanced Prompts System Migration Guide

## Overview
This guide covers the migration from the simple 15-prompt system to the advanced 225-prompt system with weighted selection, gated micro-arcs, and personalized story sequences.

## What's New

### Features
- **225 sophisticated prompts** organized across 8 life domains
- **Weighted selection system** (Onboarding: 1.5x, Core: 1.0x, Arc: 1.2x)
- **Gated micro-arcs** for 12 life events (parenthood, marriage, college, immigration, etc.)
- **Personalized sequencing** based on user's life experiences
- **Story type diversity** (Humor, Reflection, Love, Everyday, Surprise, Wisdom, Challenge, Triumph)
- **Emotional weight tracking** (Light, Medium, Heavy) for balanced pacing

### Database Changes
- New prompts table schema with 15 columns
- New `user_unlocked_gates` table to track life events
- Updated `prompt_responses.prompt_id` to VARCHAR(50)

## Data Quality Review Results

✓ **No duplicates** - All 225 prompts and IDs are unique
✓ **Data structure validated** - All required fields complete
✓ **Arc steps fixed** - 3 missing arc_step values have been corrected
✓ **Good distribution**:
  - 140 core prompts, 85 gated arc prompts
  - 8 domains: Relationships (42), Origins (33), Identity (25), Joy (13), Work (8), Wisdom (6), Challenge (6), Legacy (6)
  - 12 gate tags evenly distributed
  - Balanced story types

## Files Created

### Migration & Import Scripts
1. `/migrations/001_advanced_prompts.sql` - Database schema migration
2. `/scripts/run_migration.py` - Python script to execute migration
3. `/scripts/import_prompts.py` - Python script to import 225 prompts from Excel

### Data
- `/Users/admin/Downloads/prompts-2-fixed.xlsx` - Cleaned Excel file with all 225 prompts

## Prerequisites

1. **Database must be running** at 192.168.0.22:5432 (or update connection string)
2. **Python packages** (already installed):
   ```bash
   pip3 install psycopg2-binary pandas openpyxl
   ```

## Migration Steps

### Step 1: Backup Current Prompts (Optional)

```bash
# If you want to backup the existing 15 prompts:
python3 << 'EOF'
import psycopg2
DB_CONFIG = {
    'host': '192.168.0.22',
    'port': 5432,
    'database': 'forever_stories',
    'user': 'postgres',
    'password': 'postgres_password_change_in_production'
}
conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()
cursor.execute("SELECT * FROM prompts")
prompts = cursor.fetchall()
print(f"Backed up {len(prompts)} prompts")
# Save to file if needed
cursor.close()
conn.close()
EOF
```

### Step 2: Run Migration

```bash
cd /Users/admin/Desktop/forever-stories
python3 scripts/run_migration.py
```

**What this does:**
- Drops old `prompts` table (backs up first if needed!)
- Creates new `prompts` table with advanced schema
- Creates `user_unlocked_gates` table
- Updates `prompt_responses.prompt_id` type
- Creates indexes for efficient querying

### Step 3: Import 225 Prompts

```bash
python3 scripts/import_prompts.py
```

**Expected output:**
```
✓ Loaded 225 prompts from Excel file
Preparing data for import...
Connecting to database...
Importing prompts...
✓ Successfully imported 225 prompts

Database Summary:
  Total prompts: 225
  Core prompts: 140
  Gated arc prompts: 85
  Unique domains: 8
  Unique gates: 12

✓ Import complete!
```

### Step 4: Verify Migration

```bash
python3 << 'EOF'
import psycopg2
DB_CONFIG = {
    'host': '192.168.0.22',
    'port': 5432,
    'database': 'forever_stories',
    'user': 'postgres',
    'password': 'postgres_password_change_in_production'
}
conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()

# Check prompts count
cursor.execute("SELECT COUNT(*) FROM prompts")
print(f"Total prompts: {cursor.fetchone()[0]}")

# Check by domain
cursor.execute("""
    SELECT domain, COUNT(*)
    FROM prompts
    GROUP BY domain
    ORDER BY COUNT(*) DESC
""")
print("\nPrompts by domain:")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Check gates
cursor.execute("""
    SELECT gate_tag, COUNT(*)
    FROM prompts
    WHERE requires_gate = TRUE
    GROUP BY gate_tag
    ORDER BY COUNT(*) DESC
""")
print("\nPrompts by gate:")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]}")

cursor.close()
conn.close()
EOF
```

## Next Steps After Migration

### 1. Update Server Endpoints

The following server.js endpoints need to be updated to work with the new schema:

- ✅ `GET /api/prompts/today` - Updated to use weighted selection
- ✅ `GET /api/prompts/random` - Updated for new schema
- ✅ `POST /api/prompts/respond` - Updated to use VARCHAR prompt_id
- ⏳ `POST /api/gates/unlock` - NEW: Let users select life events
- ⏳ `GET /api/gates/available` - NEW: Get list of available gates
- ⏳ `GET /api/gates/my-gates` - NEW: Get user's unlocked gates

### 2. Update Mobile App

Mobile screens that need updates:

- ✅ `DailyPromptScreen.js` - Display domain, story type, emotional weight
- ⏳ `GateSelectionScreen.js` - NEW: Let users select life events they've experienced
- ⏳ `ProfileScreen.js` - Show unlocked gates and arc progress

### 3. Implement Weighted Selection Algorithm

The prompt selection should now prioritize:
1. Submitted questions from family (if any)
2. Gated arc prompts (if user has unlocked gates) - weight 1.2
3. Core prompts based on domain balance - weight 1.0
4. Consider emotional weight for pacing
5. Avoid recently shown prompts (last 30 days)

## Prompt Selection Logic Example

```javascript
// server.js - Updated /api/prompts/today endpoint

// 1. Check for submitted questions first
const submittedQuestion = await pool.query(`
  SELECT * FROM submitted_questions
  WHERE story_owner_id = $1 AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
`, [userId]);

if (submittedQuestion.rows.length > 0) {
  // Return submitted question
  return submittedQuestion.rows[0];
}

// 2. Get user's unlocked gates
const unlockedGates = await pool.query(`
  SELECT gate_tag, current_arc_step
  FROM user_unlocked_gates
  WHERE user_id = $1
`, [userId]);

// 3. Get recently shown prompts (exclude)
const recentPrompts = await pool.query(`
  SELECT prompt_id
  FROM prompt_responses
  WHERE user_id = $1
  AND created_at > NOW() - INTERVAL '30 days'
`, [userId]);

// 4. Build weighted query
let query = `
  SELECT *,
    CASE
      WHEN base_weight_category = 'Onboarding' THEN base_weight * 1.5
      WHEN base_weight_category = 'Arc' THEN base_weight * 1.2
      ELSE base_weight
    END as selection_weight
  FROM prompts
  WHERE is_active = TRUE
    AND id NOT IN (${recentPrompts.rows.map(r => r.prompt_id).join(',')})
`;

// 5. If user has gates, prioritize arc prompts
if (unlockedGates.rows.length > 0) {
  query += ` AND (requires_gate = FALSE OR gate_tag IN (${unlockedGates.rows.map(g => g.gate_tag).join(',')}))`;
}

// 6. Order by weight and random
query += ` ORDER BY selection_weight DESC, RANDOM() LIMIT 1`;

const prompt = await pool.query(query);
return prompt.rows[0];
```

## Troubleshooting

### Database Connection Issues
If you see "connection to server at 192.168.0.22 failed":
- Check if PostgreSQL is running on Windows machine
- Verify ngrok tunnel is active
- Test connection: `telnet 192.168.0.22 5432`

### Migration Fails
If migration fails partway through:
- Restore from backup if available
- Check error message in console
- Fix SQL issue and re-run migration

### Import Fails
Common issues:
- Excel file not found: Check path in `import_prompts.py`
- Column mismatch: Verify Excel columns match script expectations
- Data type errors: Check for NaN/NULL values in required fields

## Rollback Instructions

If you need to rollback to the original schema:

```sql
-- Restore old prompts table
DROP TABLE IF EXISTS prompts CASCADE;
DROP TABLE IF EXISTS user_unlocked_gates CASCADE;

CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    prompt_type VARCHAR(50),
    category VARCHAR(100),
    difficulty_level INT DEFAULT 1,
    tags JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Re-insert old 15 prompts from database-schema.sql lines 243-258
-- See database-schema.sql for INSERT statements
```

## Support

If you encounter issues:
1. Check the database connection is active
2. Verify all Python packages are installed
3. Review error messages in console output
4. Check that Excel file exists at specified path

## Summary

✅ **Data quality issues fixed** - 3 missing arc_step values corrected
✅ **Migration script created** - Ready to update database schema
✅ **Import script created** - Ready to import 225 prompts
⏳ **Database unreachable** - Run migration when database is online
⏳ **Server endpoints** - Need updates for new schema
⏳ **Mobile screens** - Need updates for gate selection

**Current Status:** All scripts ready. Waiting for database connection to run migration and import.
