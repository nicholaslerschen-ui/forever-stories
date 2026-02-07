-- ============================================================================
-- FOREVER STORIES DATABASE SCHEMA
-- PostgreSQL / Supabase
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- USER PROFILES TABLE
-- ============================================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    birth_date DATE,
    birth_location VARCHAR(255),
    life_events JSONB DEFAULT '[]',
    interests JSONB DEFAULT '[]',
    additional_info JSONB DEFAULT '{}',
    timezone VARCHAR(100) DEFAULT 'America/Phoenix',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- ============================================================================
-- USER FILES TABLE
-- ============================================================================
CREATE TABLE user_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL, -- S3/Cloud Storage path
    file_type VARCHAR(100),
    file_size BIGINT,
    encryption_key VARCHAR(500), -- For encrypted files
    metadata JSONB DEFAULT '{}', -- OCR text, image analysis, etc.
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_user_files_user_id ON user_files(user_id);
CREATE INDEX idx_user_files_uploaded_at ON user_files(uploaded_at DESC);

-- ============================================================================
-- PROMPTS TABLE
-- ============================================================================
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    prompt_type VARCHAR(50), -- reflective, nostalgic, values, emotional, surface
    category VARCHAR(100), -- family, career, relationships, hobbies, etc.
    difficulty_level INT DEFAULT 1, -- 1-5
    tags JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompts_type ON prompts(prompt_type);
CREATE INDEX idx_prompts_category ON prompts(category);

-- ============================================================================
-- PROMPT RESPONSES TABLE
-- ============================================================================
CREATE TABLE prompt_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id),
    prompt_text TEXT NOT NULL, -- Stored in case prompt changes
    response_text TEXT NOT NULL,
    response_type VARCHAR(50) DEFAULT 'text', -- text, voice, video
    audio_file_path VARCHAR(1000), -- If voice response
    duration_seconds INT, -- Time spent responding
    follow_up_questions JSONB DEFAULT '[]',
    ai_analysis JSONB DEFAULT '{}', -- Sentiment, themes, entities extracted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_prompt_responses_user_id ON prompt_responses(user_id);
CREATE INDEX idx_prompt_responses_created_at ON prompt_responses(created_at DESC);
CREATE INDEX idx_prompt_responses_prompt_id ON prompt_responses(prompt_id);

-- ============================================================================
-- RESPONSE FILES TABLE (Links media files to prompt responses)
-- ============================================================================
CREATE TABLE response_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID REFERENCES prompt_responses(id) ON DELETE CASCADE,
    file_id UUID REFERENCES user_files(id) ON DELETE CASCADE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(response_id, file_id)
);

CREATE INDEX idx_response_files_response ON response_files(response_id);
CREATE INDEX idx_response_files_file ON response_files(file_id);

-- ============================================================================
-- USER STATS TABLE (Gamification)
-- ============================================================================
CREATE TABLE user_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    points INT DEFAULT 0,
    total_responses INT DEFAULT 0,
    total_words_written INT DEFAULT 0,
    achievements JSONB DEFAULT '[]',
    badges JSONB DEFAULT '[]',
    last_response_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);

-- ============================================================================
-- PERSONA CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE persona_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_session_id UUID DEFAULT uuid_generate_v4(),
    user_message TEXT NOT NULL,
    persona_response TEXT NOT NULL,
    context_used JSONB DEFAULT '{}', -- Which memories/data were referenced
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_persona_conversations_user_id ON persona_conversations(user_id);
CREATE INDEX idx_persona_conversations_session ON persona_conversations(conversation_session_id);
CREATE INDEX idx_persona_conversations_created_at ON persona_conversations(created_at DESC);

-- ============================================================================
-- ACCESS GRANTS TABLE (Family/Friend Access)
-- ============================================================================
CREATE TABLE access_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    access_level VARCHAR(50) NOT NULL, -- 'view', 'chat', 'full'
    permissions JSONB DEFAULT '{}', -- Granular permissions
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_access_grants_owner_id ON access_grants(owner_id);
CREATE INDEX idx_access_grants_recipient_email ON access_grants(recipient_email);
CREATE INDEX idx_access_grants_recipient_user_id ON access_grants(recipient_user_id);

-- ============================================================================
-- SUBMITTED QUESTIONS TABLE (Family/Friend Questions for Story Owner)
-- ============================================================================
CREATE TABLE submitted_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    submitter_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    submitter_email VARCHAR(255),
    question_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, used, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_as_prompt_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_submitted_questions_owner ON submitted_questions(story_owner_id);
CREATE INDEX idx_submitted_questions_status ON submitted_questions(status);
CREATE INDEX idx_submitted_questions_created ON submitted_questions(created_at DESC);

-- ============================================================================
-- PERSONA EMBEDDINGS TABLE (Vector Search for Semantic Similarity)
-- ============================================================================
-- Requires pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE persona_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50), -- 'response', 'file', 'value', 'memory'
    content_id UUID, -- Reference to the original content
    content_text TEXT,
    embedding vector(1536), -- OpenAI ada-002 or Claude embeddings
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_persona_embeddings_user_id ON persona_embeddings(user_id);
CREATE INDEX idx_persona_embeddings_content_type ON persona_embeddings(content_type);
-- For vector similarity search
CREATE INDEX ON persona_embeddings USING ivfflat (embedding vector_cosine_ops);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50), -- 'daily_prompt', 'milestone', 'access_granted'
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================================================
-- ACHIEVEMENTS TABLE
-- ============================================================================
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    points_reward INT DEFAULT 0,
    criteria JSONB NOT NULL, -- Conditions to unlock
    rarity VARCHAR(50), -- common, rare, epic, legendary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- USER ACHIEVEMENTS TABLE
-- ============================================================================
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- ============================================================================
-- SEED DATA - Sample Prompts
-- ============================================================================
INSERT INTO prompts (title, question, prompt_type, category) VALUES
    ('A Defining Moment', 'What moment in your life changed who you are as a person?', 'reflective', 'life_story'),
    ('Childhood Memory', 'What is your earliest memory? What do you remember about that time?', 'nostalgic', 'childhood'),
    ('Life Philosophy', 'What is the most important lesson life has taught you?', 'values', 'wisdom'),
    ('Proud Achievement', 'What accomplishment are you most proud of and why?', 'emotional', 'achievements'),
    ('Daily Routine', 'Describe a typical day in your life right now.', 'surface', 'daily_life'),
    ('Family Story', 'Tell me about a family tradition or story passed down to you.', 'nostalgic', 'family'),
    ('Career Journey', 'What led you to your career? What did you learn along the way?', 'reflective', 'career'),
    ('Love Story', 'How did you meet your significant other? What drew you to them?', 'emotional', 'relationships'),
    ('Difficult Time', 'Tell me about a challenge you overcame. What did it teach you?', 'reflective', 'challenges'),
    ('Simple Pleasure', 'What is something small that brings you joy?', 'surface', 'happiness'),
    ('Advice to Youth', 'What advice would you give to your younger self?', 'values', 'wisdom'),
    ('Friendship', 'Tell me about a friendship that shaped your life.', 'emotional', 'relationships'),
    ('Travel Memory', 'Describe a place you visited that left a lasting impression.', 'nostalgic', 'travel'),
    ('Core Value', 'What value or principle do you hold most dear?', 'values', 'character'),
    ('Dream Fulfilled', 'Tell me about a dream or goal you achieved.', 'emotional', 'achievements');

-- ============================================================================
-- SEED DATA - Sample Achievements
-- ============================================================================
INSERT INTO achievements (name, description, icon, points_reward, criteria, rarity) VALUES
    ('First Story', 'Share your first memory', '🌟', 100, '{"responses": 1}', 'common'),
    ('Week Warrior', 'Maintain a 7-day streak', '🔥', 200, '{"streak": 7}', 'common'),
    ('Century Club', 'Share 100 memories', '💯', 500, '{"responses": 100}', 'rare'),
    ('Wordsmith', 'Write 10,000 words', '📝', 300, '{"words": 10000}', 'rare'),
    ('Memory Keeper', 'Upload 50 photos or documents', '📸', 250, '{"files": 50}', 'rare'),
    ('Legacy Builder', 'Complete 30 days of responses', '🏛️', 1000, '{"total_days": 30}', 'epic'),
    ('Philosopher', 'Answer 20 values-based prompts', '🧠', 400, '{"values_prompts": 20}', 'epic'),
    ('Time Traveler', 'Share memories spanning 50+ years', '⏰', 750, '{"year_span": 50}', 'legendary');

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE submitted_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY user_profiles_policy ON user_profiles
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY user_files_policy ON user_files
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY prompt_responses_policy ON prompt_responses
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY response_files_policy ON response_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM prompt_responses pr
            WHERE pr.id = response_files.response_id
            AND pr.user_id = auth.uid()
        )
    );

CREATE POLICY user_stats_policy ON user_stats
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY persona_conversations_policy ON persona_conversations
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY persona_embeddings_policy ON persona_embeddings
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY notifications_policy ON notifications
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY user_achievements_policy ON user_achievements
    FOR ALL USING (user_id = auth.uid());

-- Access grants: users can see grants they created or received
CREATE POLICY access_grants_owner_policy ON access_grants
    FOR ALL USING (owner_id = auth.uid() OR recipient_user_id = auth.uid());

-- Submitted questions: users can see questions submitted to them or by them
CREATE POLICY submitted_questions_owner_policy ON submitted_questions
    FOR ALL USING (story_owner_id = auth.uid() OR submitter_user_id = auth.uid());

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate streak
CREATE OR REPLACE FUNCTION calculate_streak(p_user_id UUID)
RETURNS INT AS $$
DECLARE
    v_streak INT := 0;
    v_current_date DATE := CURRENT_DATE;
    v_check_date DATE;
BEGIN
    -- Get dates of responses in descending order
    FOR v_check_date IN
        SELECT DATE(created_at) as response_date
        FROM prompt_responses
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
    LOOP
        IF v_check_date = v_current_date OR v_check_date = v_current_date - 1 THEN
            v_streak := v_streak + 1;
            v_current_date := v_check_date - 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_streak;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for user dashboard
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    us.streak,
    us.points,
    us.total_responses,
    COUNT(DISTINCT pr.id) as this_month_responses,
    COUNT(DISTINCT uf.id) as total_files
FROM users u
LEFT JOIN user_stats us ON u.id = us.user_id
LEFT JOIN prompt_responses pr ON u.id = pr.user_id 
    AND pr.created_at > DATE_TRUNC('month', CURRENT_DATE)
LEFT JOIN user_files uf ON u.id = uf.user_id
GROUP BY u.id, u.email, u.full_name, us.streak, us.points, us.total_responses;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional performance indexes
CREATE INDEX idx_prompt_responses_user_prompt ON prompt_responses(user_id, prompt_id);
CREATE INDEX idx_user_files_user_type ON user_files(user_id, file_type);
CREATE INDEX idx_persona_conversations_user_session ON persona_conversations(user_id, conversation_session_id);

-- Full-text search indexes
CREATE INDEX idx_prompt_responses_text ON prompt_responses USING gin(to_tsvector('english', response_text));
CREATE INDEX idx_prompts_question ON prompts USING gin(to_tsvector('english', question));

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core user accounts and authentication';
COMMENT ON TABLE user_profiles IS 'Extended user profile information from intake';
COMMENT ON TABLE user_files IS 'Uploaded documents, photos, letters, journals';
COMMENT ON TABLE prompts IS 'Daily prompts and questions for users';
COMMENT ON TABLE prompt_responses IS 'User responses to daily prompts';
COMMENT ON TABLE response_files IS 'Junction table linking media files to prompt responses';
COMMENT ON TABLE user_stats IS 'Gamification stats: streaks, points, achievements';
COMMENT ON TABLE persona_conversations IS 'Chat history with AI persona';
COMMENT ON TABLE access_grants IS 'Family/friend access permissions';
COMMENT ON TABLE submitted_questions IS 'Questions submitted by family/friends for story owner';
COMMENT ON TABLE persona_embeddings IS 'Vector embeddings for semantic search';
COMMENT ON TABLE achievements IS 'Available achievements and badges';
COMMENT ON TABLE user_achievements IS 'User-unlocked achievements';
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
-- ============================================================================
-- MIGRATION: Phase 1 - Foundation (Master Spec Compliance)
-- Date: February 1, 2026
-- Purpose: Implement role system, simplify access model, add onboarding flag
-- ============================================================================

-- ============================================================================
-- 1. ADD ROLE COLUMN TO USERS TABLE
-- ============================================================================
-- Add role to distinguish Owner (story creator) from Viewer (family member)
ALTER TABLE users
ADD COLUMN role VARCHAR(20) DEFAULT 'owner' CHECK (role IN ('owner', 'viewer'));

-- Create index for role-based queries
CREATE INDEX idx_users_role ON users(role);

-- Comment for clarity
COMMENT ON COLUMN users.role IS 'Account type: owner (creates stories) or viewer (views shared stories)';

-- ============================================================================
-- 2. ADD ONBOARDING FLAG TO USERS TABLE
-- ============================================================================
-- Track if user has completed or skipped their first system prompt
-- This prevents family questions from appearing during onboarding
ALTER TABLE users
ADD COLUMN first_system_prompt_completed BOOLEAN DEFAULT FALSE;

-- Create index for onboarding queries
CREATE INDEX idx_users_onboarding ON users(first_system_prompt_completed);

-- Comment for clarity
COMMENT ON COLUMN users.first_system_prompt_completed IS 'TRUE after user completes or skips their first system prompt (not family question)';

-- ============================================================================
-- 3. SIMPLIFY ACCESS_GRANTS TO BINARY ON/OFF
-- ============================================================================
-- Remove multi-tier access levels in favor of simple binary access
-- Spec requirement: "There is only one access state per viewer: ON or OFF"

-- Drop the complex access_level column
ALTER TABLE access_grants
DROP COLUMN IF EXISTS access_level;

-- Drop the granular permissions JSONB column
ALTER TABLE access_grants
DROP COLUMN IF EXISTS permissions;

-- Add simple binary access flag
-- Note: is_active already exists and serves this purpose
-- We'll use is_active as the ON/OFF switch
-- revoked_at IS NULL AND is_active = TRUE means access is ON
-- revoked_at IS NOT NULL OR is_active = FALSE means access is OFF

-- Add constraint to ensure consistency
ALTER TABLE access_grants
ADD CONSTRAINT access_grants_consistency CHECK (
  (revoked_at IS NULL AND is_active = TRUE) OR
  (revoked_at IS NOT NULL AND is_active = FALSE)
);

-- Comment for clarity
COMMENT ON TABLE access_grants IS 'Simple binary access control: is_active=TRUE means viewer can view shared responses and submit questions';
COMMENT ON COLUMN access_grants.is_active IS 'Binary access switch: TRUE = ON (can view + submit questions), FALSE = OFF';
COMMENT ON COLUMN access_grants.revoked_at IS 'When access was turned OFF. NULL means access is ON';

-- ============================================================================
-- 4. UPDATE SUBMITTED_QUESTIONS TABLE
-- ============================================================================
-- Add index to optimize family question queries
CREATE INDEX IF NOT EXISTS idx_submitted_questions_pending_fifo
ON submitted_questions(story_owner_id, created_at ASC)
WHERE status = 'pending';

-- Comment for clarity
COMMENT ON INDEX idx_submitted_questions_pending_fifo IS 'Optimizes FIFO (first-in-first-out) family question selection';

-- ============================================================================
-- 5. DATA MIGRATION
-- ============================================================================

-- Set all existing users to 'owner' role (default is already set)
-- This is safe because viewers don't exist yet in the system
UPDATE users SET role = 'owner' WHERE role IS NULL;

-- Mark users who have already answered prompts as having completed onboarding
-- This prevents disruption for existing users
UPDATE users
SET first_system_prompt_completed = TRUE
WHERE id IN (
  SELECT DISTINCT user_id
  FROM prompt_responses
  WHERE prompt_id IS NOT NULL  -- Exclude free writes
  LIMIT 1
);

-- For access_grants: ensure consistency
-- If revoked_at is set, ensure is_active is FALSE
UPDATE access_grants
SET is_active = FALSE
WHERE revoked_at IS NOT NULL AND is_active = TRUE;

-- If is_active is FALSE but revoked_at is NULL, set revoked_at to now
UPDATE access_grants
SET revoked_at = NOW()
WHERE is_active = FALSE AND revoked_at IS NULL;

-- ============================================================================
-- 6. VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify all users have a role
-- Expected: 0 rows
-- SELECT id, email FROM users WHERE role IS NULL;

-- Verify access_grants consistency
-- Expected: 0 rows
-- SELECT * FROM access_grants
-- WHERE (revoked_at IS NULL AND is_active = FALSE)
--    OR (revoked_at IS NOT NULL AND is_active = TRUE);

-- Count users by role
-- SELECT role, COUNT(*) FROM users GROUP BY role;

-- Count users with onboarding completed
-- SELECT
--   first_system_prompt_completed,
--   COUNT(*)
-- FROM users
-- GROUP BY first_system_prompt_completed;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- WARNING: Only run these if migration fails and you need to rollback

-- DROP INDEX IF EXISTS idx_users_role;
-- DROP INDEX IF EXISTS idx_users_onboarding;
-- DROP INDEX IF EXISTS idx_submitted_questions_pending_fifo;
-- ALTER TABLE users DROP COLUMN IF EXISTS role;
-- ALTER TABLE users DROP COLUMN IF EXISTS first_system_prompt_completed;
-- ALTER TABLE access_grants DROP CONSTRAINT IF EXISTS access_grants_consistency;
-- -- Note: Cannot restore dropped columns (access_level, permissions)

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- ============================================================================
-- MIGRATION: Phase 2 - Invite System (Master Spec Compliance)
-- Date: February 1, 2026
-- Purpose: Implement invite tokens and enhance access grants tracking
-- ============================================================================

-- ============================================================================
-- 1. CREATE INVITE TOKENS TABLE
-- ============================================================================
-- Stores invite codes sent by owners to family members
CREATE TABLE invite_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(100) UNIQUE NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX idx_invite_tokens_code ON invite_tokens(invite_code);
CREATE INDEX idx_invite_tokens_owner ON invite_tokens(owner_id);
CREATE INDEX idx_invite_tokens_active ON invite_tokens(is_active) WHERE is_active = TRUE;

-- Add comments for clarity
COMMENT ON TABLE invite_tokens IS 'Invite codes sent by owners to family members (viewers)';
COMMENT ON COLUMN invite_tokens.invite_code IS 'Unique 8-character alphanumeric code (e.g., ABC123XY)';
COMMENT ON COLUMN invite_tokens.recipient_email IS 'Email address where invite was sent';
COMMENT ON COLUMN invite_tokens.expires_at IS 'Invites expire after 30 days if not used';
COMMENT ON COLUMN invite_tokens.used_at IS 'When the invite was accepted by a viewer';
COMMENT ON COLUMN invite_tokens.used_by_user_id IS 'Which viewer account used this invite';
COMMENT ON COLUMN invite_tokens.is_active IS 'FALSE after invite is used or manually deactivated';

-- ============================================================================
-- 2. ENHANCE ACCESS_GRANTS TABLE
-- ============================================================================
-- Add columns to track invite source and timing
ALTER TABLE access_grants
ADD COLUMN invited_via_code VARCHAR(100),
ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN access_granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for viewer and owner lookups
CREATE INDEX IF NOT EXISTS idx_access_grants_viewer ON access_grants(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_owner ON access_grants(owner_id);

-- Add comments
COMMENT ON COLUMN access_grants.invited_via_code IS 'The invite code used to create this access grant (if applicable)';
COMMENT ON COLUMN access_grants.invited_at IS 'When the viewer accepted the invite';
COMMENT ON COLUMN access_grants.access_granted_at IS 'When access was first granted to this viewer';

-- ============================================================================
-- 3. DATA MIGRATION
-- ============================================================================

-- Set access_granted_at for existing access grants
UPDATE access_grants
SET access_granted_at = granted_at
WHERE access_granted_at IS NULL;

-- ============================================================================
-- 4. VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify invite_tokens table exists
-- Expected: Table with proper structure
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'invite_tokens' ORDER BY ordinal_position;

-- Verify access_grants has new columns
-- Expected: invited_via_code, invited_at, access_granted_at columns exist
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'access_grants' AND column_name IN ('invited_via_code', 'invited_at', 'access_granted_at');

-- Count invite tokens (should be 0 initially)
-- SELECT COUNT(*) FROM invite_tokens;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- WARNING: Only run these if migration fails and you need to rollback

-- DROP TABLE IF EXISTS invite_tokens CASCADE;
-- DROP INDEX IF EXISTS idx_invite_tokens_code;
-- DROP INDEX IF EXISTS idx_invite_tokens_owner;
-- DROP INDEX IF EXISTS idx_invite_tokens_active;
-- ALTER TABLE access_grants DROP COLUMN IF EXISTS invited_via_code;
-- ALTER TABLE access_grants DROP COLUMN IF EXISTS invited_at;
-- ALTER TABLE access_grants DROP COLUMN IF EXISTS access_granted_at;
-- DROP INDEX IF EXISTS idx_access_grants_viewer;
-- DROP INDEX IF EXISTS idx_access_grants_owner;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- ============================================================================
-- MIGRATION: Add delivery method to invite tokens
-- Date: February 1, 2026
-- Purpose: Track whether invite was sent via email or SMS
-- ============================================================================

ALTER TABLE invite_tokens
ADD COLUMN delivery_method VARCHAR(20) DEFAULT 'email' CHECK (delivery_method IN ('email', 'sms'));

COMMENT ON COLUMN invite_tokens.delivery_method IS 'How the invite was sent: email or sms';

-- Set existing invites to email
UPDATE invite_tokens
SET delivery_method = 'email'
WHERE delivery_method IS NULL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
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
-- ============================================================================
-- MIGRATION: 006 - Reverse Invite System (Viewer to Owner)
-- Date: February 1, 2026
-- Purpose: Implement reverse invite flow where viewers invite their parents/owners
-- ============================================================================

-- ============================================================================
-- 1. CREATE REVERSE INVITE TOKENS TABLE
-- ============================================================================
-- Stores invite codes sent by viewers to their parents (who will become owners)
CREATE TABLE IF NOT EXISTS reverse_invite_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(100) UNIQUE NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('email', 'sms')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_owner_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX idx_reverse_invite_tokens_code ON reverse_invite_tokens(invite_code);
CREATE INDEX idx_reverse_invite_tokens_viewer ON reverse_invite_tokens(viewer_id);
CREATE INDEX idx_reverse_invite_tokens_active ON reverse_invite_tokens(is_active) WHERE is_active = TRUE;

-- Add comments for clarity
COMMENT ON TABLE reverse_invite_tokens IS 'Invite codes sent by viewers to their parents (who will become owners)';
COMMENT ON COLUMN reverse_invite_tokens.invite_code IS 'Unique 8-character alphanumeric code (e.g., ABC123XY)';
COMMENT ON COLUMN reverse_invite_tokens.recipient_email IS 'Email address where invite was sent (if delivery_method = email)';
COMMENT ON COLUMN reverse_invite_tokens.recipient_phone IS 'Phone number where invite was sent (if delivery_method = sms)';
COMMENT ON COLUMN reverse_invite_tokens.delivery_method IS 'How the invite was delivered: email or sms';
COMMENT ON COLUMN reverse_invite_tokens.expires_at IS 'Reverse invites expire after 30 days if not used';
COMMENT ON COLUMN reverse_invite_tokens.used_at IS 'When the invite was accepted by an owner during signup';
COMMENT ON COLUMN reverse_invite_tokens.used_by_owner_id IS 'Which owner account used this reverse invite';
COMMENT ON COLUMN reverse_invite_tokens.is_active IS 'FALSE after invite is used or manually deactivated';

-- ============================================================================
-- 2. VALIDATION QUERIES (RUN AFTER MIGRATION)
-- ============================================================================

-- Verify reverse_invite_tokens table exists
-- Expected: Table with proper structure
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'reverse_invite_tokens' ORDER BY ordinal_position;

-- Count reverse invite tokens (should be 0 initially)
-- SELECT COUNT(*) FROM reverse_invite_tokens;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
-- WARNING: Only run these if migration fails and you need to rollback

-- DROP TABLE IF EXISTS reverse_invite_tokens CASCADE;
-- DROP INDEX IF EXISTS idx_reverse_invite_tokens_code;
-- DROP INDEX IF EXISTS idx_reverse_invite_tokens_viewer;
-- DROP INDEX IF EXISTS idx_reverse_invite_tokens_active;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
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
