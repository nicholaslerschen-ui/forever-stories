-- ============================================================================
-- MIGRATION: 008 - Subscription / Premium Tier
-- Date: March 7, 2026
-- Purpose: Add subscription tracking columns to users table
-- ============================================================================

-- Add subscription columns to users table (separate statements for compatibility)
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS rc_customer_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE;

-- Index for fast subscription lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_rc_customer ON users(rc_customer_id);

-- Comments
COMMENT ON COLUMN users.subscription_tier IS 'free or premium';
COMMENT ON COLUMN users.subscription_status IS 'active, canceled, expired, billing_issue';
COMMENT ON COLUMN users.rc_customer_id IS 'RevenueCat customer ID for subscription management';
COMMENT ON COLUMN users.subscription_ends_at IS 'When the current subscription period ends';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_tier;
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;
-- ALTER TABLE users DROP COLUMN IF EXISTS rc_customer_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_ends_at;
-- DROP INDEX IF EXISTS idx_users_subscription_tier;
-- DROP INDEX IF EXISTS idx_users_rc_customer;
