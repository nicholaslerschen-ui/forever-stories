-- ============================================================================
-- MIGRATION: Phase 2 - Invite System (Master Spec Compliance)
-- Date: February 1, 2026
-- Purpose: Implement invite tokens and enhance access grants tracking
-- ============================================================================

-- ============================================================================
-- 1. CREATE INVITE TOKENS TABLE
-- ============================================================================
-- Stores invite codes sent by owners to family members
CREATE TABLE invite_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(100) UNIQUE NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX idx_invite_tokens_code ON invite_tokens(invite_code);
CREATE INDEX idx_invite_tokens_owner ON invite_tokens(owner_id);
CREATE INDEX idx_invite_tokens_active ON invite_tokens(is_active) WHERE is_active = TRUE;

-- Add comments for clarity
COMMENT ON TABLE invite_tokens IS 'Invite codes sent by owners to family members (viewers)';
COMMENT ON COLUMN invite_tokens.invite_code IS 'Unique 8-character alphanumeric code (e.g., ABC123XY)';
COMMENT ON COLUMN invite_tokens.recipient_email IS 'Email address where invite was sent';
COMMENT ON COLUMN invite_tokens.expires_at IS 'Invites expire after 30 days if not used';
COMMENT ON COLUMN invite_tokens.used_at IS 'When the invite was accepted by a viewer';
COMMENT ON COLUMN invite_tokens.used_by_user_id IS 'Which viewer account used this invite';
COMMENT ON COLUMN invite_tokens.is_active IS 'FALSE after invite is used or manually deactivated';

-- ============================================================================
-- 2. ENHANCE ACCESS_GRANTS TABLE
-- ============================================================================
-- Add columns to track invite source and timing
ALTER TABLE access_grants
ADD COLUMN invited_via_code VARCHAR(100),
ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN access_granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for viewer and owner lookups
CREATE INDEX IF NOT EXISTS idx_access_grants_viewer ON access_grants(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_owner ON access_grants(owner_id);

-- Add comments
COMMENT ON COLUMN access_grants.invited_via_code IS 'The invite code used to create this access grant (if applicable)';
COMMENT ON COLUMN access_grants.invited_at IS 'When the viewer accepted the invite';
COMMENT ON COLUMN access_grants.access_granted_at IS 'When access was first granted to this viewer';

-- ============================================================================
-- 3. DATA MIGRATION
-- ============================================================================

-- Set access_granted_at for existing access grants
UPDATE access_grants
SET access_granted_at = granted_at
WHERE access_granted_at IS NULL;

-- ============================================================================
-- 4. VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify invite_tokens table exists
-- Expected: Table with proper structure
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'invite_tokens' ORDER BY ordinal_position;

-- Verify access_grants has new columns
-- Expected: invited_via_code, invited_at, access_granted_at columns exist
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'access_grants' AND column_name IN ('invited_via_code', 'invited_at', 'access_granted_at');

-- Count invite tokens (should be 0 initially)
-- SELECT COUNT(*) FROM invite_tokens;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- WARNING: Only run these if migration fails and you need to rollback

-- DROP TABLE IF EXISTS invite_tokens CASCADE;
-- DROP INDEX IF EXISTS idx_invite_tokens_code;
-- DROP INDEX IF EXISTS idx_invite_tokens_owner;
-- DROP INDEX IF EXISTS idx_invite_tokens_active;
-- ALTER TABLE access_grants DROP COLUMN IF EXISTS invited_via_code;
-- ALTER TABLE access_grants DROP COLUMN IF EXISTS invited_at;
-- ALTER TABLE access_grants DROP COLUMN IF EXISTS access_granted_at;
-- DROP INDEX IF EXISTS idx_access_grants_viewer;
-- DROP INDEX IF EXISTS idx_access_grants_owner;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
