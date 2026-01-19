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
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_grants ENABLE ROW LEVEL SECURITY;
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
COMMENT ON TABLE user_stats IS 'Gamification stats: streaks, points, achievements';
COMMENT ON TABLE persona_conversations IS 'Chat history with AI persona';
COMMENT ON TABLE access_grants IS 'Family/friend access permissions';
COMMENT ON TABLE persona_embeddings IS 'Vector embeddings for semantic search';
COMMENT ON TABLE achievements IS 'Available achievements and badges';
COMMENT ON TABLE user_achievements IS 'User-unlocked achievements';
