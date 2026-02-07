-- ============================================================================
-- MIGRATION: Advanced Prompts System with Gating and Micro-Arcs
-- ============================================================================

-- Drop existing prompts table (backup data if needed first!)
-- WARNING: This will delete all existing prompts
DROP TABLE IF EXISTS prompts CASCADE;

-- ============================================================================
-- NEW PROMPTS TABLE - Advanced System
-- ============================================================================
CREATE TABLE prompts (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'Origins_Humor_1', 'Arc_Love_3'
    domain VARCHAR(50) NOT NULL, -- Origins, Relationships, Identity, Joy, Work, Wisdom, Challenge, Legacy
    story_type VARCHAR(50) NOT NULL, -- Humor & Lightness, Reflection & Wisdom, Love & Connection, etc.
    emotional_weight VARCHAR(20) NOT NULL, -- Light, Medium, Heavy
    prompt_text TEXT NOT NULL,
    requires_gate BOOLEAN DEFAULT FALSE,
    gate_tag VARCHAR(50), -- parenthood, partnership_marriage, college_education, etc.
    arc_step INTEGER, -- 0-10 for sequencing within a gate
    notes TEXT,
    review_status VARCHAR(20),
    rating INTEGER, -- 1-5 quality rating
    is_core BOOLEAN DEFAULT TRUE,
    base_weight_category VARCHAR(20), -- Onboarding, Core, Arc
    base_weight DECIMAL(3, 2), -- 1.0, 1.2, 1.5
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_prompts_domain ON prompts(domain);
CREATE INDEX idx_prompts_story_type ON prompts(story_type);
CREATE INDEX idx_prompts_emotional_weight ON prompts(emotional_weight);
CREATE INDEX idx_prompts_gate_tag ON prompts(gate_tag) WHERE requires_gate = TRUE;
CREATE INDEX idx_prompts_is_core ON prompts(is_core);
CREATE INDEX idx_prompts_is_active ON prompts(is_active);
CREATE INDEX idx_prompts_arc_step ON prompts(arc_step) WHERE requires_gate = TRUE;

-- Full-text search on prompt_text
CREATE INDEX idx_prompts_text_search ON prompts USING gin(to_tsvector('english', prompt_text));

-- Composite indexes for weighted selection
CREATE INDEX idx_prompts_core_active ON prompts(is_core, is_active, base_weight);
CREATE INDEX idx_prompts_gate_active ON prompts(gate_tag, is_active, base_weight) WHERE requires_gate = TRUE;

-- ============================================================================
-- USER UNLOCKED GATES TABLE - Track which life events users have experienced
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_unlocked_gates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    gate_tag VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_arc_step INTEGER DEFAULT 0, -- Track progress through the arc
    UNIQUE(user_id, gate_tag)
);

CREATE INDEX idx_user_unlocked_gates_user_id ON user_unlocked_gates(user_id);
CREATE INDEX idx_user_unlocked_gates_gate_tag ON user_unlocked_gates(gate_tag);

-- Enable RLS (Supabase only - disabled for local PostgreSQL)
-- ALTER TABLE user_unlocked_gates ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY user_unlocked_gates_policy ON user_unlocked_gates
--     FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- UPDATE PROMPT_RESPONSES TO USE NEW PROMPT ID TYPE
-- ============================================================================
-- The prompt_id column needs to match the new prompts table ID type
ALTER TABLE prompt_responses
    ALTER COLUMN prompt_id TYPE VARCHAR(50);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE prompts IS 'Advanced prompts system with weighted selection, gating, and micro-arcs';
COMMENT ON TABLE user_unlocked_gates IS 'Life events/gates unlocked by users for personalized prompt arcs';
COMMENT ON COLUMN prompts.base_weight IS 'Selection weight: Onboarding=1.5, Core=1.0, Arc=1.2';
COMMENT ON COLUMN prompts.arc_step IS 'Sequence position within a gated micro-arc (0-10)';
COMMENT ON COLUMN user_unlocked_gates.current_arc_step IS 'Track how far user has progressed in this gate arc';
