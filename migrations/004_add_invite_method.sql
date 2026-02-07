-- ============================================================================
-- MIGRATION: Add delivery method to invite tokens
-- Date: February 1, 2026
-- Purpose: Track whether invite was sent via email or SMS
-- ============================================================================

ALTER TABLE invite_tokens
ADD COLUMN delivery_method VARCHAR(20) DEFAULT 'email' CHECK (delivery_method IN ('email', 'sms'));

COMMENT ON COLUMN invite_tokens.delivery_method IS 'How the invite was sent: email or sms';

-- Set existing invites to email
UPDATE invite_tokens
SET delivery_method = 'email'
WHERE delivery_method IS NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
