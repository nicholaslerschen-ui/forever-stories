-- ============================================================================
-- MIGRATION: 007 - Push Notifications System
-- Date: February 5, 2026
-- Purpose: Add device token storage and notification preferences
-- ============================================================================

-- ============================================================================
-- 1. CREATE PUSH_TOKENS TABLE
-- ============================================================================
-- Stores FCM/APNs device tokens for push notifications
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android')),
    device_id VARCHAR(255), -- Unique device identifier
    app_version VARCHAR(50),
    os_version VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one token per device per user
    UNIQUE(user_id, device_id)
);

-- Create indexes for performance
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_push_tokens_device ON push_tokens(device_id);

-- Add comments for clarity
COMMENT ON TABLE push_tokens IS 'Stores FCM/APNs device tokens for push notifications';
COMMENT ON COLUMN push_tokens.device_token IS 'FCM token (Android) or APNs token (iOS)';
COMMENT ON COLUMN push_tokens.device_type IS 'Platform: ios or android';
COMMENT ON COLUMN push_tokens.device_id IS 'Unique device identifier to prevent duplicate tokens';
COMMENT ON COLUMN push_tokens.is_active IS 'FALSE if token is invalid or user uninstalled app';
COMMENT ON COLUMN push_tokens.last_used_at IS 'Last time this token was successfully used';

-- ============================================================================
-- 2. CREATE NOTIFICATION_PREFERENCES TABLE
-- ============================================================================
-- User preferences for what notifications they want to receive
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

    -- Notification types (all enabled by default)
    daily_prompt_enabled BOOLEAN DEFAULT TRUE,
    daily_prompt_time TIME DEFAULT '09:00:00', -- 9 AM local time

    family_questions_enabled BOOLEAN DEFAULT TRUE,

    responses_received_enabled BOOLEAN DEFAULT TRUE, -- For viewers

    streak_reminders_enabled BOOLEAN DEFAULT TRUE,
    streak_reminder_time TIME DEFAULT '20:00:00', -- 8 PM local time

    weekly_summary_enabled BOOLEAN DEFAULT TRUE,
    weekly_summary_day INT DEFAULT 0 CHECK (weekly_summary_day >= 0 AND weekly_summary_day <= 6), -- 0=Sunday

    -- Global notification toggle
    notifications_enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- Add comments
COMMENT ON TABLE notification_preferences IS 'User preferences for push notifications';
COMMENT ON COLUMN notification_preferences.daily_prompt_time IS 'Local time to send daily prompt reminder (if enabled)';
COMMENT ON COLUMN notification_preferences.notifications_enabled IS 'Master switch - FALSE disables all notifications';

-- ============================================================================
-- 3. CREATE NOTIFICATION_LOG TABLE
-- ============================================================================
-- Tracks all notifications sent (for debugging and analytics)
CREATE TABLE IF NOT EXISTS notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- daily_prompt, family_question, streak_reminder, etc.
    title VARCHAR(255),
    body TEXT,
    data JSONB DEFAULT '{}', -- Additional payload data
    device_token TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered BOOLEAN DEFAULT NULL, -- NULL=unknown, TRUE=delivered, FALSE=failed
    error_message TEXT
);

CREATE INDEX idx_notification_log_user ON notification_log(user_id);
CREATE INDEX idx_notification_log_type ON notification_log(notification_type);
CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at DESC);

-- Add comments
COMMENT ON TABLE notification_log IS 'Audit log of all push notifications sent';
COMMENT ON COLUMN notification_log.delivered IS 'NULL=pending, TRUE=delivered, FALSE=failed';

-- ============================================================================
-- 4. ADD NOTIFICATION COLUMNS TO USERS TABLE
-- ============================================================================
-- Track user notification stats
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_last_notification ON users(last_notification_at);

COMMENT ON COLUMN users.last_notification_at IS 'Last time user received any push notification';
COMMENT ON COLUMN users.notification_count IS 'Total notifications sent to this user';

-- ============================================================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================================================
-- Auto-update updated_at timestamps
CREATE TRIGGER update_push_tokens_updated_at BEFORE UPDATE ON push_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. SEED DEFAULT NOTIFICATION PREFERENCES FOR EXISTING USERS
-- ============================================================================
-- Give all existing users default notification preferences
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 7. VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify push_tokens table exists
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'push_tokens' ORDER BY ordinal_position;

-- Verify notification_preferences table exists
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'notification_preferences' ORDER BY ordinal_position;

-- Verify all users have notification preferences
-- SELECT COUNT(*) FROM users;
-- SELECT COUNT(*) FROM notification_preferences;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- WARNING: Only run these if migration fails and you need to rollback

-- DROP TABLE IF EXISTS notification_log CASCADE;
-- DROP TABLE IF EXISTS notification_preferences CASCADE;
-- DROP TABLE IF EXISTS push_tokens CASCADE;
-- DROP INDEX IF EXISTS idx_push_tokens_user;
-- DROP INDEX IF EXISTS idx_push_tokens_active;
-- DROP INDEX IF EXISTS idx_push_tokens_device;
-- DROP INDEX IF EXISTS idx_notification_prefs_user;
-- DROP INDEX IF EXISTS idx_notification_log_user;
-- DROP INDEX IF EXISTS idx_notification_log_type;
-- DROP INDEX IF EXISTS idx_notification_log_sent_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_notification_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS notification_count;
-- DROP INDEX IF EXISTS idx_users_last_notification;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
