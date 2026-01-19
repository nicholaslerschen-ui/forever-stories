// server.js - Main Express server with Claude AI integration
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Database connection (supports both Supabase and direct PostgreSQL)
let db;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  console.log('📊 Using Supabase database');
} else if (process.env.DATABASE_URL) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  // Wrapper to make PostgreSQL interface similar to Supabase
  db = {
    from: (table) => ({
      select: (columns = '*') => ({
        eq: async (field, value) => {
          try {
            const result = await pool.query(
              `SELECT ${columns} FROM ${table} WHERE ${field} = $1`,
              [value]
            );
            return { data: result.rows, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        single: async () => {
          try {
            const result = await pool.query(`SELECT ${columns} FROM ${table} LIMIT 1`);
            return { data: result.rows[0], error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      }),
      insert: (data) => ({
        select: () => ({
          single: async () => {
            try {
              const keys = Object.keys(data[0]);
              const values = Object.values(data[0]);
              const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
              
              const result = await pool.query(
                `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`,
                values
              );
              return { data: result.rows[0], error: null };
            } catch (error) {
              return { data: null, error };
            }
          }
        })
      }),
      upsert: (data) => ({
        select: () => ({
          single: async () => {
            try {
              const keys = Object.keys(data);
              const values = Object.values(data);
              const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
              const updates = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
              
              const result = await pool.query(
                `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) 
                 ON CONFLICT (user_id) DO UPDATE SET ${updates} RETURNING *`,
                [...values, ...values]
              );
              return { data: result.rows[0], error: null };
            } catch (error) {
              return { data: null, error };
            }
          }
        })
      })
    })
  };
  console.log('📊 Using PostgreSQL database');
} else {
  console.error('❌ No database configuration found. Please set SUPABASE_URL or DATABASE_URL');
  process.exit(1);
}

// Ensure uploads directory exists
const uploadsDir = process.env.FILE_STORAGE_PATH || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// File upload configuration
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
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
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: db ? 'connected' : 'disconnected',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing'
  });
});

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const { data, error } = await db
      .from('users')
      .insert([
        {
          email,
          password_hash: hashedPassword,
          full_name: fullName,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message || 'Failed to create user' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: data.id, email: data.email },
      process.env.JWT_SECRET || 'development-secret-key',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: data.id,
        email: data.email,
        fullName: data.full_name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: user, error } = await db
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// INTAKE/PROFILE ENDPOINTS
// ============================================================================

// Save intake data
app.post('/api/profile/intake', authenticateToken, async (req, res) => {
  try {
    const { birthDate, birthLocation, lifeEvents, interests } = req.body;

    const { data, error } = await db
      .from('user_profiles')
      .upsert({
        user_id: req.user.userId,
        birth_date: birthDate,
        birth_location: birthLocation,
        life_events: lifeEvents,
        interests: interests,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, profile: data });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await db
      .from('user_profiles')
      .select('*')
      .eq('user_id', req.user.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(400).json({ error: error.message });
    }

    res.json({ profile: data || null });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SIMPLE TEST ENDPOINTS (for development)
// ============================================================================

app.get('/api/test/prompts', authenticateToken, async (req, res) => {
  // Return sample prompts for testing without AI
  res.json({
    prompts: [
      {
        id: 1,
        title: "A Defining Moment",
        question: "What moment in your life changed who you are as a person?",
        type: "reflective",
        category: "life_story"
      },
      {
        id: 2,
        title: "Childhood Memory",
        question: "What is your earliest memory? What do you remember about that time?",
        type: "nostalgic",
        category: "childhood"
      },
      {
        id: 3,
        title: "Life Philosophy",
        question: "What is the most important lesson life has taught you?",
        type: "values",
        category: "wisdom"
      }
    ]
  });
});

app.get('/api/test/stats', authenticateToken, async (req, res) => {
  // Return sample stats for testing
  res.json({
    stats: {
      streak: 7,
      longestStreak: 14,
      points: 350,
      totalResponses: 12,
      achievements: ["first-story", "week-warrior"]
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🎉 Forever Stories API Server');
  console.log('================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log('================================');
  console.log('');
});

module.exports = app;
