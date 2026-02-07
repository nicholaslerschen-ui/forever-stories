#!/bin/bash

# Quick test to check if Supabase is ready

echo "🔌 Testing Supabase connection..."

python3 << 'EOF'
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
    cursor.execute('SELECT NOW(), version()')
    result = cursor.fetchone()
    print(f"\n✅ Supabase is READY!")
    print(f"   Server time: {result[0]}")
    print(f"   PostgreSQL: {result[1][:60]}...")
    print("\n🚀 You can now run: ./deploy_prompts.sh")
    cursor.close()
    conn.close()
    sys.exit(0)
except Exception as e:
    print(f"\n❌ Supabase not ready yet")
    print(f"   Error: {str(e)[:100]}")
    print("\n⏳ Maintenance may still be in progress.")
    print("   Check: https://status.supabase.com")
    print("   Try again in a few minutes!")
    sys.exit(1)
EOF
