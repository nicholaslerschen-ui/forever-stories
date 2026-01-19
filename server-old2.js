// server.js - Main Express server with PostgreSQL support and Daily Prompts
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

console.log('📊 Using PostgreSQL database');

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'development-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW()) 
       RETURNING id, email, full_name`,
      [email, hashedPassword, fullName]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'development-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'development-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

// Save intake data
app.post('/api/profile/intake', authenticateToken, async (req, res) => {
  try {
    const { birthDate, birthLocation, lifeEvents, interests } = req.body;
    const userId = req.user.userId;

    // Check if profile exists
    const existing = await pool.query(
      'SELECT id FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length > 0) {
      // Update existing profile
      const result = await pool.query(
        `UPDATE user_profiles 
         SET birth_date = $1, birth_location = $2, life_events = $3, interests = $4, updated_at = NOW()
         WHERE user_id = $5
         RETURNING *`,
        [birthDate, birthLocation, JSON.stringify(lifeEvents), JSON.stringify(interests), userId]
      );
      res.json({ success: true, profile: result.rows[0] });
    } else {
      // Create new profile
      const result = await pool.query(
        `INSERT INTO user_profiles (user_id, birth_date, birth_location, life_events, interests, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING *`,
        [userId, birthDate, birthLocation, JSON.stringify(lifeEvents), JSON.stringify(interests)]
      );
      res.json({ success: true, profile: result.rows[0] });
    }
  } catch (error) {
    console.error('Profile save error:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ profile: null });
    }

    const profile = result.rows[0];
    
    // Parse JSON fields
    if (profile.life_events && typeof profile.life_events === 'string') {
      profile.life_events = JSON.parse(profile.life_events);
    }
    if (profile.interests && typeof profile.interests === 'string') {
      profile.interests = JSON.parse(profile.interests);
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ============================================================================
// DAILY PROMPTS
// ============================================================================

// Get today's prompt for user
app.get('/api/prompts/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if user already answered today
    const existingResponse = await pool.query(
      `SELECT pr.*, dp.question, dp.category 
       FROM prompt_responses pr
       JOIN daily_prompts dp ON pr.prompt_id = dp.id
       WHERE pr.user_id = $1 AND DATE(pr.created_at) = $2`,
      [userId, today]
    );

    if (existingResponse.rows.length > 0) {
      return res.json({
        answered: true,
        response: existingResponse.rows[0]
      });
    }

    // Get user profile for personalization
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    let interests = [];
    let lifeEvents = [];
    let birthLocation = null;

    if (profileResult.rows.length > 0) {
      const profile = profileResult.rows[0];
      interests = profile.interests ? JSON.parse(profile.interests) : [];
      lifeEvents = profile.life_events ? JSON.parse(profile.life_events) : [];
      birthLocation = profile.birth_location;
    }

    // Get prompts user hasn't answered yet
    const promptsResult = await pool.query(
      `SELECT dp.* FROM daily_prompts dp
       WHERE dp.id NOT IN (
         SELECT prompt_id FROM prompt_responses WHERE user_id = $1
       )
       ORDER BY RANDOM()
       LIMIT 10`,
      [userId]
    );

    let selectedPrompt = null;

    if (promptsResult.rows.length > 0) {
      // Try to find a prompt matching user's interests or life events
      for (const prompt of promptsResult.rows) {
        const category = prompt.category?.toLowerCase() || '';
        
        // Check if prompt category matches interests
        if (interests.some(interest => category.includes(interest.toLowerCase()))) {
          selectedPrompt = prompt;
          break;
        }
        
        // Check if prompt category matches life events
        if (lifeEvents.some(event => category.includes(event.toLowerCase()))) {
          selectedPrompt = prompt;
          break;
        }
      }

      // If no match, just use first available prompt
      if (!selectedPrompt) {
        selectedPrompt = promptsResult.rows[0];
      }

      // Personalize the question if possible
      let personalizedQuestion = selectedPrompt.question;
      if (birthLocation && personalizedQuestion.includes('{location}')) {
        personalizedQuestion = personalizedQuestion.replace('{location}', birthLocation);
      }

      res.json({
        answered: false,
        prompt: {
          id: selectedPrompt.id,
          question: personalizedQuestion,
          category: selectedPrompt.category,
          type: selectedPrompt.prompt_type
        }
      });
    } else {
      // All prompts answered - could reset or generate new ones
      res.json({
        answered: false,
        prompt: {
          id: null,
          question: "You've answered all available prompts! Tell me about a memory that made you smile recently.",
          category: "general",
          type: "nostalgic"
        }
      });
    }
  } catch (error) {
    console.error('Get today prompt error:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

// Submit prompt response
app.post('/api/prompts/respond', authenticateToken, async (req, res) => {
  try {
    const { promptId, response } = req.body;
    const userId = req.user.userId;

    if (!response || response.trim().length === 0) {
      return res.status(400).json({ error: 'Response cannot be empty' });
    }

    // Save response
    const result = await pool.query(
      `INSERT INTO prompt_responses (user_id, prompt_id, response, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [userId, promptId, response]
    );

    // Calculate streak
    const streakResult = await pool.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) as streak
       FROM prompt_responses
       WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC`,
      [userId]
    );

    const streak = streakResult.rows[0]?.streak || 1;

    // Award points (50 points per prompt)
    const points = 50;

    res.json({
      success: true,
      response: result.rows[0],
      streak: streak,
      pointsEarned: points,
      message: 'Response saved successfully!'
    });
  } catch (error) {
    console.error('Save response error:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Get user's response history
app.get('/api/prompts/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT pr.*, dp.question, dp.category, dp.prompt_type
       FROM prompt_responses pr
       JOIN daily_prompts dp ON pr.prompt_id = dp.id
       WHERE pr.user_id = $1
       ORDER BY pr.created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      responses: result.rows
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get user stats
app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Total responses
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM prompt_responses WHERE user_id = $1',
      [userId]
    );

    // Current streak (consecutive days)
    const streakResult = await pool.query(
      `WITH daily_responses AS (
        SELECT DISTINCT DATE(created_at) as response_date
        FROM prompt_responses
        WHERE user_id = $1
        ORDER BY response_date DESC
      ),
      streak_calc AS (
        SELECT 
          response_date,
          response_date - ROW_NUMBER() OVER (ORDER BY response_date DESC)::int AS grp
        FROM daily_responses
      )
      SELECT COUNT(*) as streak
      FROM streak_calc
      WHERE grp = (SELECT MAX(grp) FROM streak_calc)`,
      [userId]
    );

    const total = parseInt(totalResult.rows[0]?.total || 0);
    const streak = parseInt(streakResult.rows[0]?.streak || 0);
    const points = total * 50; // 50 points per response

    res.json({
      stats: {
        totalResponses: total,
        currentStreak: streak,
        totalPoints: points,
        longestStreak: streak // Simplified for now
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🎉 Forever Stories API Server');
  console.log('================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log('📅 Daily Prompts: ENABLED');
  console.log('================================');
  console.log('');
});

module.exports = app;
