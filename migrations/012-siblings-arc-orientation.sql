-- ============================================================================
-- MIGRATION: 012 - Add Siblings Arc Orientation Prompt
-- Date: February 9, 2026
-- Purpose: Add Step 0 orientation prompt for Siblings life event
-- ============================================================================

-- Add arc orientation prompt (Step 0) to set context for sibling arc
-- Follows the pattern from other life events (career_pivot, sports_competition, creative_hobby)

INSERT INTO prompts VALUES (
  'Origins_Everyday_Siblings_0',
  'Gate Arc (varies)',
  'Everyday Humanity',
  'Light',
  'You mentioned having siblings. To start this sibling arc, tell me about them - how many siblings do you have, are they brothers or sisters, and are you older or younger?',
  TRUE,
  'siblings',
  0,
  'Arc orientation prompt',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify Step 0 was added
-- SELECT id, arc_step, emotional_weight, prompt_text
-- FROM prompts
-- WHERE gate_tag = 'siblings' AND arc_step = 0;

-- View all siblings prompts in order
-- SELECT arc_step, emotional_weight, LEFT(prompt_text, 80) as prompt_preview
-- FROM prompts
-- WHERE gate_tag = 'siblings'
-- ORDER BY arc_step;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
