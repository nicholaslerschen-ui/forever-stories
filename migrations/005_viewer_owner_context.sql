-- ============================================================================
-- MIGRATION: Add viewer-owner context tracking
-- Date: February 1, 2026
-- Purpose: Support viewers with multiple owners, add helpful indexes
-- ============================================================================

-- No schema changes needed - access_grants already supports multiple owners!
-- The table structure allows one viewer (recipient_user_id) to have multiple
-- owner connections (different owner_id values)

-- Add index for faster viewer → owners lookup
CREATE INDEX IF NOT EXISTS idx_access_grants_viewer_active
ON access_grants(recipient_user_id)
WHERE is_active = TRUE AND revoked_at IS NULL;

-- Add index for faster owner → viewers lookup (if not exists)
CREATE INDEX IF NOT EXISTS idx_access_grants_owner_active
ON access_grants(owner_id)
WHERE is_active = TRUE AND revoked_at IS NULL;

-- Add composite index for viewer-owner pair lookups
CREATE INDEX IF NOT EXISTS idx_access_grants_viewer_owner
ON access_grants(recipient_user_id, owner_id);

-- Add helpful comments
COMMENT ON TABLE access_grants IS 'Maps viewers to owners with access control. One viewer can have multiple owner connections via multiple rows with different owner_id values.';

COMMENT ON COLUMN access_grants.recipient_user_id IS 'The viewer who has access (same viewer can appear in multiple rows for different owners)';
COMMENT ON COLUMN access_grants.owner_id IS 'The owner whose content is accessible (different per viewer-owner relationship)';

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Check viewers with multiple owners (should work with existing schema)
SELECT
  recipient_user_id,
  COUNT(DISTINCT owner_id) as owner_count,
  array_agg(owner_id ORDER BY access_granted_at) as owner_ids
FROM access_grants
WHERE is_active = TRUE AND revoked_at IS NULL
GROUP BY recipient_user_id
HAVING COUNT(DISTINCT owner_id) > 1;

-- Verify indexes were created
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'access_grants'
  AND indexname LIKE 'idx_access_grants_%';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
