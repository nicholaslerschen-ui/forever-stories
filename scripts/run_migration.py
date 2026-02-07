#!/usr/bin/env python3
"""
Run database migration for advanced prompts system
"""

import psycopg2
import sys

# Database configuration - Local Mac PostgreSQL
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'forever_stories',
    'user': 'admin',
    'password': 'Docker4Nick'
}

MIGRATION_FILE = '/Users/admin/Desktop/forever-stories/migrations/001_advanced_prompts.sql'

def run_migration():
    print("Forever Stories - Database Migration")
    print("=" * 50)
    print("Running: 001_advanced_prompts.sql")
    print()

    try:
        # Connect to database
        print("Connecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Read migration file
        print("Reading migration file...")
        with open(MIGRATION_FILE, 'r') as f:
            migration_sql = f.read()

        # Execute migration
        print("Executing migration...")
        cursor.execute(migration_sql)
        conn.commit()

        print("✓ Migration completed successfully")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
