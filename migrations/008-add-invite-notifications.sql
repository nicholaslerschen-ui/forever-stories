-- ============================================================================
-- MIGRATION: 008 - Add Invite Notifications Preference
-- Date: February 6, 2026
-- Purpose: Add invite notification preference to notification_preferences table
-- ============================================================================

-- Add invites_enabled column for invite notification preference
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS invites_enabled BOOLEAN DEFAULT TRUE;

-- Add comment
COMMENT ON COLUMN notification_preferences.invites_enabled IS 'Receive notifications when invited to view stories';

-- ============================================================================
-- VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify column was added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'notification_preferences' AND column_name = 'invites_enabled';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
