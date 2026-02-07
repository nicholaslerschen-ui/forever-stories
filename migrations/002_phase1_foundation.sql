-- ============================================================================
-- MIGRATION: Phase 1 - Foundation (Master Spec Compliance)
-- Date: February 1, 2026
-- Purpose: Implement role system, simplify access model, add onboarding flag
-- ============================================================================

-- ============================================================================
-- 1. ADD ROLE COLUMN TO USERS TABLE
-- ============================================================================
-- Add role to distinguish Owner (story creator) from Viewer (family member)
ALTER TABLE users
ADD COLUMN role VARCHAR(20) DEFAULT 'owner' CHECK (role IN ('owner', 'viewer'));

-- Create index for role-based queries
CREATE INDEX idx_users_role ON users(role);

-- Comment for clarity
COMMENT ON COLUMN users.role IS 'Account type: owner (creates stories) or viewer (views shared stories)';

-- ============================================================================
-- 2. ADD ONBOARDING FLAG TO USERS TABLE
-- ============================================================================
-- Track if user has completed or skipped their first system prompt
-- This prevents family questions from appearing during onboarding
ALTER TABLE users
ADD COLUMN first_system_prompt_completed BOOLEAN DEFAULT FALSE;

-- Create index for onboarding queries
CREATE INDEX idx_users_onboarding ON users(first_system_prompt_completed);

-- Comment for clarity
COMMENT ON COLUMN users.first_system_prompt_completed IS 'TRUE after user completes or skips their first system prompt (not family question)';

-- ============================================================================
-- 3. SIMPLIFY ACCESS_GRANTS TO BINARY ON/OFF
-- ============================================================================
-- Remove multi-tier access levels in favor of simple binary access
-- Spec requirement: "There is only one access state per viewer: ON or OFF"

-- Drop the complex access_level column
ALTER TABLE access_grants
DROP COLUMN IF EXISTS access_level;

-- Drop the granular permissions JSONB column
ALTER TABLE access_grants
DROP COLUMN IF EXISTS permissions;

-- Add simple binary access flag
-- Note: is_active already exists and serves this purpose
-- We'll use is_active as the ON/OFF switch
-- revoked_at IS NULL AND is_active = TRUE means access is ON
-- revoked_at IS NOT NULL OR is_active = FALSE means access is OFF

-- Add constraint to ensure consistency
ALTER TABLE access_grants
ADD CONSTRAINT access_grants_consistency CHECK (
  (revoked_at IS NULL AND is_active = TRUE) OR
  (revoked_at IS NOT NULL AND is_active = FALSE)
);

-- Comment for clarity
COMMENT ON TABLE access_grants IS 'Simple binary access control: is_active=TRUE means viewer can view shared responses and submit questions';
COMMENT ON COLUMN access_grants.is_active IS 'Binary access switch: TRUE = ON (can view + submit questions), FALSE = OFF';
COMMENT ON COLUMN access_grants.revoked_at IS 'When access was turned OFF. NULL means access is ON';

-- ============================================================================
-- 4. UPDATE SUBMITTED_QUESTIONS TABLE
-- ============================================================================
-- Add index to optimize family question queries
CREATE INDEX IF NOT EXISTS idx_submitted_questions_pending_fifo
ON submitted_questions(story_owner_id, created_at ASC)
WHERE status = 'pending';

-- Comment for clarity
COMMENT ON INDEX idx_submitted_questions_pending_fifo IS 'Optimizes FIFO (first-in-first-out) family question selection';

-- ============================================================================
-- 5. DATA MIGRATION
-- ============================================================================

-- Set all existing users to 'owner' role (default is already set)
-- This is safe because viewers don't exist yet in the system
UPDATE users SET role = 'owner' WHERE role IS NULL;

-- Mark users who have already answered prompts as having completed onboarding
-- This prevents disruption for existing users
UPDATE users
SET first_system_prompt_completed = TRUE
WHERE id IN (
  SELECT DISTINCT user_id
  FROM prompt_responses
  WHERE prompt_id IS NOT NULL  -- Exclude free writes
  LIMIT 1
);

-- For access_grants: ensure consistency
-- If revoked_at is set, ensure is_active is FALSE
UPDATE access_grants
SET is_active = FALSE
WHERE revoked_at IS NOT NULL AND is_active = TRUE;

-- If is_active is FALSE but revoked_at is NULL, set revoked_at to now
UPDATE access_grants
SET revoked_at = NOW()
WHERE is_active = FALSE AND revoked_at IS NULL;

-- ============================================================================
-- 6. VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify all users have a role
-- Expected: 0 rows
-- SELECT id, email FROM users WHERE role IS NULL;

-- Verify access_grants consistency
-- Expected: 0 rows
-- SELECT * FROM access_grants
-- WHERE (revoked_at IS NULL AND is_active = FALSE)
--    OR (revoked_at IS NOT NULL AND is_active = TRUE);

-- Count users by role
-- SELECT role, COUNT(*) FROM users GROUP BY role;

-- Count users with onboarding completed
-- SELECT
--   first_system_prompt_completed,
--   COUNT(*)
-- FROM users
-- GROUP BY first_system_prompt_completed;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- WARNING: Only run these if migration fails and you need to rollback

-- DROP INDEX IF EXISTS idx_users_role;
-- DROP INDEX IF EXISTS idx_users_onboarding;
-- DROP INDEX IF EXISTS idx_submitted_questions_pending_fifo;
-- ALTER TABLE users DROP COLUMN IF EXISTS role;
-- ALTER TABLE users DROP COLUMN IF EXISTS first_system_prompt_completed;
-- ALTER TABLE access_grants DROP CONSTRAINT IF EXISTS access_grants_consistency;
-- -- Note: Cannot restore dropped columns (access_level, permissions)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
