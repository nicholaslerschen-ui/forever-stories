-- Add missing columns to access_grants table

ALTER TABLE access_grants
ADD COLUMN IF NOT EXISTS access_level VARCHAR(50) DEFAULT 'full',
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES users(id);

-- Update existing rows to have default access level
UPDATE access_grants SET access_level = 'full' WHERE access_level IS NULL;

-- Make access_level NOT NULL after setting defaults
ALTER TABLE access_grants
ALTER COLUMN access_level SET NOT NULL;
