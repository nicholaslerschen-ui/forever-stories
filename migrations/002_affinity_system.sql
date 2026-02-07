-- ============================================================================
-- MIGRATION: Prompt Affinity & Rating System
-- Adds support for user ratings, skip tracking, and affinity-based selection
-- ============================================================================

-- ============================================================================
-- USER PROMPT AFFINITY TABLE
-- Tracks per-user preferences for domains, story types, and depth levels
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_prompt_affinity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Affinity scores (all range from -1.0 to +1.0, default 0.0)
    domain VARCHAR(50) NOT NULL,
    story_type VARCHAR(50),
    depth VARCHAR(20), -- light, medium, heavy

    affinity_score DECIMAL(3, 2) DEFAULT 0.0 CHECK (affinity_score >= -1.0 AND affinity_score <= 1.0),

    -- Metadata
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    update_count INT DEFAULT 0,

    -- Ensure one row per user per category combination
    UNIQUE(user_id, domain, story_type, depth)
);

CREATE INDEX idx_user_affinity_user ON user_prompt_affinity(user_id);
CREATE INDEX idx_user_affinity_domain ON user_prompt_affinity(user_id, domain);

-- ============================================================================
-- USER PROMPT HISTORY TABLE
-- Tracks every time a prompt is shown (even if skipped)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_prompt_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id VARCHAR(50) NOT NULL, -- matches prompts.id

    -- Event details
    shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action VARCHAR(20) NOT NULL, -- 'shown', 'answered', 'skipped'

    -- Skip details (if action = 'skipped')
    skip_reason VARCHAR(50), -- 'not_today', 'not_relevant', 'similar_answered', null

    -- Context
    was_rescue_mode BOOLEAN DEFAULT FALSE,
    skip_count_that_day INT DEFAULT 0,

    -- Prompt metadata snapshot (for analytics)
    domain VARCHAR(50),
    story_type VARCHAR(50),
    depth VARCHAR(20),
    gate_tag VARCHAR(50)
);

CREATE INDEX idx_prompt_history_user ON user_prompt_history(user_id);
CREATE INDEX idx_prompt_history_shown_at ON user_prompt_history(shown_at DESC);
-- CREATE INDEX idx_prompt_history_user_date ON user_prompt_history(user_id, DATE(shown_at)); -- Disabled for local PostgreSQL
CREATE INDEX idx_prompt_history_prompt ON user_prompt_history(prompt_id);

-- ============================================================================
-- USER DAILY SKIP COUNTER TABLE
-- Tracks skip count per day for rescue mode logic
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,

    -- Skip tracking
    skip_count INT DEFAULT 0,
    rescue_mode_active BOOLEAN DEFAULT FALSE,

    -- Last shown prompt (for pacing rules)
    last_prompt_id VARCHAR(50),
    last_prompt_domain VARCHAR(50),
    last_prompt_story_type VARCHAR(50),
    last_prompt_depth VARCHAR(20),
    last_prompt_gate_tag VARCHAR(50),

    -- Streak tracking
    prompt_answered_today BOOLEAN DEFAULT FALSE,

    UNIQUE(user_id, stat_date)
);

CREATE INDEX idx_daily_stats_user_date ON user_daily_stats(user_id, stat_date DESC);

-- ============================================================================
-- PROMPT RATINGS TABLE
-- Stores user ratings of prompts after answering
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id VARCHAR(50) NOT NULL,
    response_id UUID REFERENCES prompt_responses(id) ON DELETE CASCADE,

    -- Rating (1=Not right today, 2=It was okay, 3=Yes)
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 3),

    -- Optional feedback
    feedback_text TEXT,

    -- Metadata
    rated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, prompt_id)
);

CREATE INDEX idx_prompt_ratings_user ON prompt_ratings(user_id);
CREATE INDEX idx_prompt_ratings_prompt ON prompt_ratings(prompt_id);
CREATE INDEX idx_prompt_ratings_rating ON prompt_ratings(rating);

-- ============================================================================
-- SUPPRESSED PROMPTS TABLE
-- Tracks prompts/categories user has marked as "not relevant"
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_suppressed_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- What to suppress
    prompt_id VARCHAR(50), -- specific prompt
    domain VARCHAR(50),    -- entire domain
    story_type VARCHAR(50), -- story type
    gate_tag VARCHAR(50),  -- entire gate

    -- Suppression level
    suppression_strength DECIMAL(3, 2) DEFAULT -0.4, -- how much to penalize (-1.0 = never show)

    -- Metadata
    suppressed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason VARCHAR(50), -- 'not_relevant', 'user_request', 'sensitive'

    -- At least one target must be specified
    CHECK (prompt_id IS NOT NULL OR domain IS NOT NULL OR story_type IS NOT NULL OR gate_tag IS NOT NULL)
);

CREATE INDEX idx_suppressed_user ON user_suppressed_prompts(user_id);
CREATE INDEX idx_suppressed_prompt ON user_suppressed_prompts(prompt_id);
CREATE INDEX idx_suppressed_domain ON user_suppressed_prompts(domain);
CREATE INDEX idx_suppressed_gate ON user_suppressed_prompts(gate_tag);

-- ============================================================================
-- ADD DEPTH COLUMN TO PROMPTS TABLE
-- ============================================================================
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS depth VARCHAR(20) DEFAULT 'medium';

-- Update depth based on emotional_weight if not set
UPDATE prompts SET depth =
    CASE
        WHEN emotional_weight = 'Light' THEN 'light'
        WHEN emotional_weight = 'Heavy' THEN 'heavy'
        ELSE 'medium'
    END
WHERE depth IS NULL OR depth = '';

CREATE INDEX idx_prompts_depth ON prompts(depth);

-- ============================================================================
-- ADD SHOWN_COUNT TO TRACK NOVELTY
-- ============================================================================
-- This will be computed from user_prompt_history, but we can cache it
-- For now, we'll compute it dynamically in the selection query

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- RLS Policies (Supabase only - disabled for local PostgreSQL)
-- ALTER TABLE user_prompt_affinity ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_prompt_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_daily_stats ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prompt_ratings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_suppressed_prompts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
-- CREATE POLICY user_affinity_policy ON user_prompt_affinity
--     FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY user_history_policy ON user_prompt_history
--     FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY user_daily_stats_policy ON user_daily_stats
--     FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY prompt_ratings_policy ON prompt_ratings
--     FOR ALL USING (user_id = auth.uid());
-- CREATE POLICY user_suppressed_policy ON user_suppressed_prompts
--     FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update affinity based on rating
CREATE OR REPLACE FUNCTION update_affinity_from_rating(
    p_user_id UUID,
    p_domain VARCHAR(50),
    p_story_type VARCHAR(50),
    p_depth VARCHAR(20),
    p_rating INT
)
RETURNS VOID AS $$
DECLARE
    v_delta DECIMAL(3, 2);
BEGIN
    -- Calculate delta based on rating
    v_delta := CASE
        WHEN p_rating = 3 THEN 0.20  -- Yes
        WHEN p_rating = 2 THEN 0.05  -- It was okay
        WHEN p_rating = 1 THEN -0.20 -- Not right today
        ELSE 0.0
    END;

    -- Update or insert affinity for domain
    INSERT INTO user_prompt_affinity (user_id, domain, story_type, depth, affinity_score, update_count)
    VALUES (p_user_id, p_domain, NULL, NULL, v_delta, 1)
    ON CONFLICT (user_id, domain, story_type, depth)
    DO UPDATE SET
        affinity_score = GREATEST(-1.0, LEAST(1.0, user_prompt_affinity.affinity_score + v_delta)),
        update_count = user_prompt_affinity.update_count + 1,
        last_updated = NOW();

    -- Update affinity for story_type
    INSERT INTO user_prompt_affinity (user_id, domain, story_type, depth, affinity_score, update_count)
    VALUES (p_user_id, NULL, p_story_type, NULL, v_delta, 1)
    ON CONFLICT (user_id, domain, story_type, depth)
    DO UPDATE SET
        affinity_score = GREATEST(-1.0, LEAST(1.0, user_prompt_affinity.affinity_score + v_delta)),
        update_count = user_prompt_affinity.update_count + 1,
        last_updated = NOW();

    -- Update affinity for depth (smaller delta)
    v_delta := v_delta * 0.5;
    INSERT INTO user_prompt_affinity (user_id, domain, story_type, depth, affinity_score, update_count)
    VALUES (p_user_id, NULL, NULL, p_depth, v_delta, 1)
    ON CONFLICT (user_id, domain, story_type, depth)
    DO UPDATE SET
        affinity_score = GREATEST(-1.0, LEAST(1.0, user_prompt_affinity.affinity_score + v_delta)),
        update_count = user_prompt_affinity.update_count + 1,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update affinity from skip
CREATE OR REPLACE FUNCTION update_affinity_from_skip(
    p_user_id UUID,
    p_domain VARCHAR(50),
    p_story_type VARCHAR(50),
    p_depth VARCHAR(20),
    p_skip_reason VARCHAR(50)
)
RETURNS VOID AS $$
DECLARE
    v_delta DECIMAL(3, 2);
BEGIN
    -- Calculate delta based on skip reason
    v_delta := CASE
        WHEN p_skip_reason = 'not_today' THEN -0.05
        WHEN p_skip_reason = 'not_relevant' THEN -0.40
        ELSE 0.0  -- No clarification = no change
    END;

    IF v_delta != 0.0 THEN
        -- Update domain affinity
        INSERT INTO user_prompt_affinity (user_id, domain, story_type, depth, affinity_score, update_count)
        VALUES (p_user_id, p_domain, NULL, NULL, v_delta, 1)
        ON CONFLICT (user_id, domain, story_type, depth)
        DO UPDATE SET
            affinity_score = GREATEST(-1.0, LEAST(1.0, user_prompt_affinity.affinity_score + v_delta)),
            update_count = user_prompt_affinity.update_count + 1,
            last_updated = NOW();

        -- Update story_type affinity
        INSERT INTO user_prompt_affinity (user_id, domain, story_type, depth, affinity_score, update_count)
        VALUES (p_user_id, NULL, p_story_type, NULL, v_delta, 1)
        ON CONFLICT (user_id, domain, story_type, depth)
        DO UPDATE SET
            affinity_score = GREATEST(-1.0, LEAST(1.0, user_prompt_affinity.affinity_score + v_delta)),
            update_count = user_prompt_affinity.update_count + 1,
            last_updated = NOW();

        -- Update depth affinity (smaller delta)
        v_delta := v_delta * 0.5;
        INSERT INTO user_prompt_affinity (user_id, domain, story_type, depth, affinity_score, update_count)
        VALUES (p_user_id, NULL, NULL, p_depth, v_delta, 1)
        ON CONFLICT (user_id, domain, story_type, depth)
        DO UPDATE SET
            affinity_score = GREATEST(-1.0, LEAST(1.0, user_prompt_affinity.affinity_score + v_delta)),
            update_count = user_prompt_affinity.update_count + 1,
            last_updated = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE user_prompt_affinity IS 'Per-user affinity scores for domains, story types, and depth levels';
COMMENT ON TABLE user_prompt_history IS 'Complete history of prompts shown to users';
COMMENT ON TABLE user_daily_stats IS 'Daily skip counts and rescue mode state';
COMMENT ON TABLE prompt_ratings IS 'User ratings of prompts after answering';
COMMENT ON TABLE user_suppressed_prompts IS 'Prompts/categories marked as not relevant by user';
