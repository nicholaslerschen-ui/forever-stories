-- ============================================================================
-- MIGRATION: 006 - Reverse Invite System (Viewer to Owner)
-- Date: February 1, 2026
-- Purpose: Implement reverse invite flow where viewers invite their parents/owners
-- ============================================================================

-- ============================================================================
-- 1. CREATE REVERSE INVITE TOKENS TABLE
-- ============================================================================
-- Stores invite codes sent by viewers to their parents (who will become owners)
CREATE TABLE IF NOT EXISTS reverse_invite_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(100) UNIQUE NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('email', 'sms')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_owner_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX idx_reverse_invite_tokens_code ON reverse_invite_tokens(invite_code);
CREATE INDEX idx_reverse_invite_tokens_viewer ON reverse_invite_tokens(viewer_id);
CREATE INDEX idx_reverse_invite_tokens_active ON reverse_invite_tokens(is_active) WHERE is_active = TRUE;

-- Add comments for clarity
COMMENT ON TABLE reverse_invite_tokens IS 'Invite codes sent by viewers to their parents (who will become owners)';
COMMENT ON COLUMN reverse_invite_tokens.invite_code IS 'Unique 8-character alphanumeric code (e.g., ABC123XY)';
COMMENT ON COLUMN reverse_invite_tokens.recipient_email IS 'Email address where invite was sent (if delivery_method = email)';
COMMENT ON COLUMN reverse_invite_tokens.recipient_phone IS 'Phone number where invite was sent (if delivery_method = sms)';
COMMENT ON COLUMN reverse_invite_tokens.delivery_method IS 'How the invite was delivered: email or sms';
COMMENT ON COLUMN reverse_invite_tokens.expires_at IS 'Reverse invites expire after 30 days if not used';
COMMENT ON COLUMN reverse_invite_tokens.used_at IS 'When the invite was accepted by an owner during signup';
COMMENT ON COLUMN reverse_invite_tokens.used_by_owner_id IS 'Which owner account used this reverse invite';
COMMENT ON COLUMN reverse_invite_tokens.is_active IS 'FALSE after invite is used or manually deactivated';

-- ============================================================================
-- 2. VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify reverse_invite_tokens table exists
-- Expected: Table with proper structure
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'reverse_invite_tokens' ORDER BY ordinal_position;

-- Count reverse invite tokens (should be 0 initially)
-- SELECT COUNT(*) FROM reverse_invite_tokens;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- WARNING: Only run these if migration fails and you need to rollback

-- DROP TABLE IF EXISTS reverse_invite_tokens CASCADE;
-- DROP INDEX IF EXISTS idx_reverse_invite_tokens_code;
-- DROP INDEX IF EXISTS idx_reverse_invite_tokens_viewer;
-- DROP INDEX IF EXISTS idx_reverse_invite_tokens_active;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
