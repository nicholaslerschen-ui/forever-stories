-- ============================================================================
-- MIGRATION: 014 - Home Remedy Prompt
-- Date: February 9, 2026
-- Purpose: Add prompt about childhood home remedies
-- ============================================================================

-- Add home remedy prompt
-- General prompt (no gate required) - accessible to all users
-- Light emotional weight, nostalgic focus on family care practices

INSERT INTO prompts VALUES (
  'Origins_Everyday_Remedies_1',
  'Origins',
  'Everyday Humanity',
  'Light',
  'When you were sick as a child, what home remedies did your family use?',
  FALSE,
  NULL,
  NULL,
  'Childhood home remedies',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify prompt was added
-- SELECT id, domain, story_type, emotional_weight, prompt_text
-- FROM prompts
-- WHERE id = 'Origins_Everyday_Remedies_1';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
