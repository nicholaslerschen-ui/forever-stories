#!/usr/bin/env python3
"""
Import prompts from Excel file into PostgreSQL database
Run after executing the migration: 001_advanced_prompts.sql
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import sys
import os

# Database configuration - Local Mac PostgreSQL
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'forever_stories',
    'user': 'admin',
    'password': 'Docker4Nick'
}

# Excel file path
EXCEL_FILE = '/Users/admin/Downloads/prompts-2-fixed.xlsx'

def connect_db():
    """Connect to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def load_excel():
    """Load prompts from Excel file"""
    try:
        df = pd.read_excel(EXCEL_FILE)
        print(f"✓ Loaded {len(df)} prompts from Excel file")
        return df
    except Exception as e:
        print(f"Error loading Excel file: {e}")
        sys.exit(1)

def prepare_data(df):
    """Prepare data for database insertion"""
    # Column mapping: Excel -> Database
    data = []

    for _, row in df.iterrows():
        record = (
            row['Prompt_id'],
            row['domain'],
            row['story_type'],
            row['emotional_weight'],
            row['prompt_text'],
            bool(row['requires_gate']),
            row['gate_tag'] if pd.notna(row['gate_tag']) else None,
            int(row['arc_step']) if pd.notna(row['arc_step']) else None,
            row['notes'] if pd.notna(row['notes']) else None,
            row['review_status'] if pd.notna(row['review_status']) else None,
            int(row['rating']) if pd.notna(row['rating']) else None,
            bool(row['is_core']),
            row['Base Weight Category'],
            float(row['Base Weight']),
            True  # is_active
        )
        data.append(record)

    return data

def import_prompts(conn, data):
    """Import prompts into database"""
    try:
        cursor = conn.cursor()

        # SQL insert statement
        insert_sql = """
            INSERT INTO prompts (
                id, domain, story_type, emotional_weight, prompt_text,
                requires_gate, gate_tag, arc_step, notes, review_status,
                rating, is_core, base_weight_category, base_weight, is_active
            ) VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                domain = EXCLUDED.domain,
                story_type = EXCLUDED.story_type,
                emotional_weight = EXCLUDED.emotional_weight,
                prompt_text = EXCLUDED.prompt_text,
                requires_gate = EXCLUDED.requires_gate,
                gate_tag = EXCLUDED.gate_tag,
                arc_step = EXCLUDED.arc_step,
                notes = EXCLUDED.notes,
                review_status = EXCLUDED.review_status,
                rating = EXCLUDED.rating,
                is_core = EXCLUDED.is_core,
                base_weight_category = EXCLUDED.base_weight_category,
                base_weight = EXCLUDED.base_weight,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
        """

        execute_values(cursor, insert_sql, data)
        conn.commit()

        print(f"✓ Successfully imported {len(data)} prompts")

        # Display summary statistics
        cursor.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN is_core THEN 1 ELSE 0 END) as core,
                SUM(CASE WHEN requires_gate THEN 1 ELSE 0 END) as gated,
                COUNT(DISTINCT domain) as domains,
                COUNT(DISTINCT gate_tag) as gates
            FROM prompts
        """)

        stats = cursor.fetchone()
        print(f"\nDatabase Summary:")
        print(f"  Total prompts: {stats[0]}")
        print(f"  Core prompts: {stats[1]}")
        print(f"  Gated arc prompts: {stats[2]}")
        print(f"  Unique domains: {stats[3]}")
        print(f"  Unique gates: {stats[4]}")

        cursor.close()

    except Exception as e:
        conn.rollback()
        print(f"Error importing prompts: {e}")
        sys.exit(1)

def main():
    print("Forever Stories - Prompt Import Script")
    print("=" * 50)

    # Check if Excel file exists
    if not os.path.exists(EXCEL_FILE):
        print(f"Error: Excel file not found at {EXCEL_FILE}")
        sys.exit(1)

    # Load data
    df = load_excel()

    # Prepare data
    print("Preparing data for import...")
    data = prepare_data(df)

    # Connect to database
    print("Connecting to database...")
    conn = connect_db()

    # Import prompts
    print("Importing prompts...")
    import_prompts(conn, data)

    # Close connection
    conn.close()
    print("\n✓ Import complete!")

if __name__ == "__main__":
    main()
