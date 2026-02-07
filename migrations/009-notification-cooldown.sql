-- ============================================================================
-- MIGRATION: 009 - Notification Cooldown Tracking
-- Date: February 6, 2026
-- Purpose: Add fields to track notification cooldown for users who don't engage
-- ============================================================================

-- Add cooldown tracking columns to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS consecutive_skips INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS in_cooldown BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS final_reminder_sent BOOLEAN DEFAULT FALSE;

-- Add comments for clarity
COMMENT ON COLUMN notification_preferences.consecutive_skips IS 'Number of consecutive days user skipped prompt after receiving reminder';
COMMENT ON COLUMN notification_preferences.last_reminder_sent_at IS 'When the last daily reminder was sent';
COMMENT ON COLUMN notification_preferences.in_cooldown IS 'TRUE if user is in 7-day cooldown period';
COMMENT ON COLUMN notification_preferences.cooldown_until IS 'When the cooldown period ends';
COMMENT ON COLUMN notification_preferences.final_reminder_sent IS 'TRUE if final "we miss you" reminder was sent after cooldown';

-- ============================================================================
-- VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify columns were added
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'notification_preferences'
-- AND column_name IN ('consecutive_skips', 'last_reminder_sent_at', 'in_cooldown', 'cooldown_until', 'final_reminder_sent');

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
