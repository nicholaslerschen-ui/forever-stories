-- ============================================================================
-- MIGRATION: 010 - Viewer Reminder Notifications
-- Date: February 9, 2026
-- Purpose: Add preference column for weekly viewer reminder notifications
-- ============================================================================

-- Add viewer reminder preference to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS viewer_reminders_enabled BOOLEAN DEFAULT TRUE;

-- Add comment for clarity
COMMENT ON COLUMN notification_preferences.viewer_reminders_enabled IS 'TRUE if viewer should receive weekly reminders to submit questions (default: enabled)';

-- ============================================================================
-- VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify column was added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'notification_preferences'
-- AND column_name = 'viewer_reminders_enabled';

-- Check current values
-- SELECT user_id, viewer_reminders_enabled
-- FROM notification_preferences
-- WHERE viewer_reminders_enabled IS NOT NULL
-- LIMIT 10;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
