-- Add timezone column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Phoenix';

-- Update existing users to detect their timezone based on browser
-- This will be set by the frontend, but default to America/Phoenix for now
UPDATE user_profiles 
SET timezone = 'America/Phoenix' 
WHERE timezone IS NULL;
