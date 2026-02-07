#!/bin/bash

# Forever Stories - Complete Prompts Deployment Script
# This script will wait for Supabase to be ready, then deploy everything

echo "🚀 Forever Stories - Prompts System Deployment"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test database connection
echo "🔌 Testing Supabase connection..."
echo ""

MAX_RETRIES=30
RETRY_DELAY=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Test connection
    python3 << 'EOF' 2>/dev/null
import psycopg2
import sys

DB_CONFIG = {
    'host': 'db.dwdeqxygemgjutlmuxdn.supabase.co',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'Supabase4Nick'
}

try:
    conn = psycopg2.connect(**DB_CONFIG, connect_timeout=5)
    cursor = conn.cursor()
    cursor.execute('SELECT NOW()')
    cursor.close()
    conn.close()
    sys.exit(0)
except:
    sys.exit(1)
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Supabase is ready!${NC}"
        echo ""
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo -e "${RED}❌ Could not connect after $MAX_RETRIES attempts${NC}"
            echo "Please check:"
            echo "  1. Supabase maintenance is complete"
            echo "  2. Database password is correct"
            echo "  3. Network connection is working"
            exit 1
        fi

        MINS_WAITED=$((RETRY_COUNT * RETRY_DELAY / 60))
        echo -e "${YELLOW}⏳ Attempt $RETRY_COUNT/$MAX_RETRIES - Supabase not ready yet (waited ${MINS_WAITED}m)${NC}"
        echo "   Maintenance may still be in progress. Retrying in ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
    fi
done

# Step 1: Run Migration
echo "📊 Step 1: Running database migration..."
python3 scripts/run_migration.py

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Migration failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration complete${NC}"
echo ""

# Step 2: Import Prompts
echo "📥 Step 2: Importing 225 prompts..."
python3 scripts/import_prompts.py

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Import failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prompts imported${NC}"
echo ""

# Step 3: Verify
echo "🔍 Step 3: Verifying deployment..."
python3 << 'EOF'
import psycopg2

DB_CONFIG = {
    'host': 'db.dwdeqxygemgjutlmuxdn.supabase.co',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'Supabase4Nick'
}

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()

    # Check prompts count
    cursor.execute("SELECT COUNT(*) FROM prompts")
    total = cursor.fetchone()[0]

    # Check by type
    cursor.execute("SELECT COUNT(*) FROM prompts WHERE is_core = TRUE")
    core = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM prompts WHERE requires_gate = TRUE")
    gated = cursor.fetchone()[0]

    # Check user_unlocked_gates table exists
    cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_unlocked_gates'")
    gates_table = cursor.fetchone()[0]

    print(f"\n✅ Verification Results:")
    print(f"   Total prompts: {total}")
    print(f"   Core prompts: {core}")
    print(f"   Gated prompts: {gated}")
    print(f"   Gates table: {'✓' if gates_table > 0 else '✗'}")

    if total == 225 and gates_table > 0:
        print("\n🎉 All checks passed!")
        exit(0)
    else:
        print("\n⚠️  Some checks failed")
        exit(1)

except Exception as e:
    print(f"❌ Verification error: {e}")
    exit(1)
finally:
    cursor.close()
    conn.close()
EOF

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Verification failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=============================================="
echo "🎉 Deployment Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Update server.js with new endpoints (see server-prompts-updates.js)"
echo "2. Restart your Node.js server"
echo "3. Test the new prompts system in your mobile app"
echo ""
echo "Documentation:"
echo "  - Migration guide: PROMPTS_MIGRATION_GUIDE.md"
echo "  - System summary: PROMPTS_SYSTEM_SUMMARY.md"
echo -e "${NC}"
