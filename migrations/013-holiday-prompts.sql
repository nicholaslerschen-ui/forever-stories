-- ============================================================================
-- MIGRATION: 013 - Holiday Celebration Prompts
-- Date: February 9, 2026
-- Purpose: Add 8 culturally neutral holiday prompts covering the full emotional spectrum
-- ============================================================================

-- Add holiday celebration prompts
-- These are general prompts (no gate required) accessible to all users
-- Culturally neutral - users can apply to any holiday they celebrate

-- ============================================================================
-- LIGHT EMOTIONAL WEIGHT
-- ============================================================================

-- Prompt 1: Childhood Holiday Humor
INSERT INTO prompts VALUES (
  'Origins_Humor_Holiday_1',
  'Origins',
  'Humor & Lightness',
  'Light',
  'Think about a holiday celebration from your childhood. What''s a funny or chaotic moment that still makes you smile?',
  FALSE,
  NULL,
  NULL,
  'Childhood holiday humor',
  'approved',
  5,
  TRUE
);

-- Prompt 2: Holiday Food Traditions
INSERT INTO prompts VALUES (
  'Joy_Everyday_Holiday_2',
  'Joy',
  'Everyday Humanity',
  'Light',
  'Describe a special dish or food that was always part of your family''s holiday celebrations. What made it memorable?',
  FALSE,
  NULL,
  NULL,
  'Holiday food traditions',
  'approved',
  5,
  TRUE
);

-- Prompt 6: Childhood Holiday Experience
INSERT INTO prompts VALUES (
  'Origins_Everyday_Holiday_6',
  'Origins',
  'Everyday Humanity',
  'Light',
  'What were holidays like in your home growing up? Share a favorite memory from those celebrations.',
  FALSE,
  NULL,
  NULL,
  'Childhood holiday experience',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- MEDIUM EMOTIONAL WEIGHT
-- ============================================================================

-- Prompt 3: Evolution of Holiday Traditions
INSERT INTO prompts VALUES (
  'Legacy_Reflection_Holiday_3',
  'Legacy',
  'Reflection & Wisdom',
  'Medium',
  'How have your holiday celebrations changed from childhood to now? What traditions have stayed the same, and what''s different?',
  FALSE,
  NULL,
  NULL,
  'Evolution of holiday traditions',
  'approved',
  5,
  TRUE
);

-- Prompt 4: Creating Personal Traditions
INSERT INTO prompts VALUES (
  'Identity_Connection_Holiday_4',
  'Identity',
  'Love & Connection',
  'Medium',
  'Tell me about a holiday tradition you started yourself. How did it begin, and why was it important to you?',
  FALSE,
  NULL,
  NULL,
  'Creating personal traditions',
  'approved',
  5,
  TRUE
);

-- Prompt 5: Holiday Connection Moments
INSERT INTO prompts VALUES (
  'Relationships_Connection_Holiday_5',
  'Relationships',
  'Love & Connection',
  'Medium',
  'Share a holiday memory when you felt especially connected to family or friends. What made that moment stand out?',
  FALSE,
  NULL,
  NULL,
  'Holiday connection moments',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- HEAVY EMOTIONAL WEIGHT
-- ============================================================================

-- Prompt 7: Holiday Loss and Absence
INSERT INTO prompts VALUES (
  'Challenge_Reflection_Holiday_7',
  'Challenge',
  'Reflection & Wisdom',
  'Heavy',
  'Tell me about a holiday that felt different because someone important was missing. How did you navigate that experience?',
  FALSE,
  NULL,
  NULL,
  'Holiday loss and absence',
  'approved',
  4,
  TRUE
);

-- Prompt 8: Holiday Wisdom and Perspective
INSERT INTO prompts VALUES (
  'Wisdom_Reflection_Holiday_8',
  'Wisdom',
  'Reflection & Wisdom',
  'Heavy',
  'As you''ve gotten older, what have you realized matters most about holiday celebrations? What matters less than you once thought?',
  FALSE,
  NULL,
  NULL,
  'Holiday wisdom and perspective',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify all 8 holiday prompts were added
-- SELECT id, domain, story_type, emotional_weight, LEFT(prompt_text, 70) as prompt_preview
-- FROM prompts
-- WHERE id LIKE '%Holiday%'
-- ORDER BY emotional_weight, id;

-- Count prompts by emotional weight
-- SELECT emotional_weight, COUNT(*) as count
-- FROM prompts
-- WHERE id LIKE '%Holiday%'
-- GROUP BY emotional_weight
-- ORDER BY emotional_weight;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
