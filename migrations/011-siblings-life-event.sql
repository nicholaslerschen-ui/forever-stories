-- ============================================================================
-- MIGRATION: 011 - Siblings Life Event & Prompts
-- Date: February 9, 2026
-- Purpose: Add 10 prompts for the Siblings life event gate
-- ============================================================================

-- Add Siblings prompts covering the full emotional spectrum
-- Arc steps 1-10 provide a progressive journey through sibling relationships

-- ============================================================================
-- LIGHT EMOTIONAL WEIGHT (Humor & Lightness)
-- ============================================================================

INSERT INTO prompts VALUES (
  'Origins_Humor_Siblings_1',
  'Origins',
  'Humor & Lightness',
  'Light',
  'Tell me about a time you and your sibling(s) got into mischief together. What happened, and did you get caught?',
  TRUE,
  'siblings',
  1,
  'Childhood sibling trouble',
  'approved',
  5,
  TRUE
);

INSERT INTO prompts VALUES (
  'Joy_Humor_Siblings_2',
  'Joy',
  'Humor & Lightness',
  'Light',
  'What''s the funniest nickname you or your siblings had growing up? How did it start?',
  TRUE,
  'siblings',
  2,
  'Sibling nicknames',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- MEDIUM EMOTIONAL WEIGHT (Reflection & Wisdom)
-- ============================================================================

INSERT INTO prompts VALUES (
  'Relationships_Reflection_Siblings_3',
  'Relationships',
  'Reflection & Wisdom',
  'Medium',
  'How has your relationship with your sibling(s) changed from childhood to now? What caused that evolution?',
  TRUE,
  'siblings',
  3,
  'Sibling relationship evolution',
  'approved',
  5,
  TRUE
);

INSERT INTO prompts VALUES (
  'Identity_Reflection_Siblings_4',
  'Identity',
  'Reflection & Wisdom',
  'Medium',
  'In what ways are you similar to your sibling(s), and in what ways are you completely different? How did that shape who you became?',
  TRUE,
  'siblings',
  4,
  'Sibling similarities and differences',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- MEDIUM EMOTIONAL WEIGHT (Love & Connection)
-- ============================================================================

INSERT INTO prompts VALUES (
  'Relationships_Connection_Siblings_5',
  'Relationships',
  'Love & Connection',
  'Medium',
  'Share a memory of a time your sibling was there for you when you really needed them. What did they do, and what did it mean to you?',
  TRUE,
  'siblings',
  5,
  'Sibling support',
  'approved',
  5,
  TRUE
);

INSERT INTO prompts VALUES (
  'Legacy_Connection_Siblings_6',
  'Legacy',
  'Love & Connection',
  'Medium',
  'What traditions or inside jokes do you share with your sibling(s) that you hope will last forever?',
  TRUE,
  'siblings',
  6,
  'Sibling traditions',
  'approved',
  5,
  TRUE
);

INSERT INTO prompts VALUES (
  'Joy_Connection_Siblings_9',
  'Joy',
  'Love & Connection',
  'Medium',
  'What''s a moment with your sibling(s) that still makes you smile when you think about it? Paint the picture for me.',
  TRUE,
  'siblings',
  9,
  'Happiest sibling memory',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- HEAVY EMOTIONAL WEIGHT (Challenge & Growth)
-- ============================================================================

INSERT INTO prompts VALUES (
  'Challenge_Growth_Siblings_7',
  'Challenge',
  'Challenge & Growth',
  'Heavy',
  'Tell me about a difficult time between you and a sibling. How did you work through it, and what did you learn?',
  TRUE,
  'siblings',
  7,
  'Sibling conflict resolution',
  'approved',
  4,
  TRUE
);

INSERT INTO prompts VALUES (
  'Challenge_Reflection_Siblings_10',
  'Challenge',
  'Reflection & Wisdom',
  'Heavy',
  'Share a difficult or sad memory you experienced with your sibling(s). How did you support each other through it?',
  TRUE,
  'siblings',
  10,
  'Difficult sibling memory',
  'approved',
  4,
  TRUE
);

-- ============================================================================
-- HEAVY EMOTIONAL WEIGHT (Reflection & Wisdom)
-- ============================================================================

INSERT INTO prompts VALUES (
  'Wisdom_Reflection_Siblings_8',
  'Wisdom',
  'Reflection & Wisdom',
  'Heavy',
  'What''s the most important lesson you learned from your sibling(s) - whether they meant to teach it or not?',
  TRUE,
  'siblings',
  8,
  'Lessons from siblings',
  'approved',
  5,
  TRUE
);

-- ============================================================================
-- VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify all 10 prompts were added
-- SELECT id, domain, story_type, emotional_weight, arc_step, prompt_text
-- FROM prompts
-- WHERE gate_tag = 'siblings'
-- ORDER BY arc_step;

-- Count prompts by emotional weight
-- SELECT emotional_weight, COUNT(*) as count
-- FROM prompts
-- WHERE gate_tag = 'siblings'
-- GROUP BY emotional_weight
-- ORDER BY emotional_weight;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
