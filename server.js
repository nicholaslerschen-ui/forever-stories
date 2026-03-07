// server.js - Main Express server with PostgreSQL support and Daily Prompts
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const cron = require('node-cron');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ============================================================================
// ENVIRONMENT VARIABLE VALIDATION
// ============================================================================
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Import prompt selection engine
const { getNextPrompt, onSkip, onRating, RATING, SKIP_REASON, SELECTION_MODE } = require('./promptSelectionEngine');

// Import push notification service
const {
  sendFamilyQuestionNotification,
  sendResponseReceivedNotification,
  sendInviteNotification,
  sendDailyPromptReminders,
  sendWeeklyViewerReminders,
  resetNotificationCooldown
} = require('./pushNotificationService');

// Import email service
const { sendWelcomeEmail, sendInviteEmail } = require('./services/emailService');

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'forever-stories-uploads';

// Multer configuration - store in memory for S3 upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10  // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/heic',
      'video/mp4', 'video/quicktime', 'video/mov'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, HEIC, MP4, MOV allowed.'));
    }
  }
});

// S3 Upload Helper Function
async function uploadToS3(file, userId) {
  const fileExtension = file.originalname.split('.').pop();
  const fileName = `${userId}/${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype
    // No ACL - files are private by default
  });

  await s3Client.send(command);

  // Return the S3 key (not the URL, we'll generate signed URLs when needed)
  return fileName;
}

// Generate a signed URL for private S3 objects (valid for 1 hour)
async function getSignedFileUrl(s3Key) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key
  });

  // URL expires in 1 hour (3600 seconds)
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// ============================================================================
// EMAIL CONFIGURATION & HELPERS
// ============================================================================

// Email service configuration (using Resend)
if (process.env.RESEND_API_KEY) {
  console.log('✉️  Email service configured (Resend)');
} else {
  console.log('⚠️  Email service not configured (RESEND_API_KEY missing)');
}

// Twilio SMS client configuration
let twilioClient = null;

// Only initialize Twilio if credentials are configured AND valid (SID starts with 'AC')
if (
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_PHONE_NUMBER
) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('📱 SMS service configured (Twilio)');
} else {
  console.log('⚠️  SMS service not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)');
}

// Helper: Generate unique 8-character invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}


// Helper: Send invite SMS
async function sendInviteSMS(recipientPhone, inviteCode, ownerName) {
  if (!twilioClient) {
    console.log('📱 SMS not configured, skipping SMS send (invite code:', inviteCode, ')');
    return;
  }

  const message = `${ownerName} has invited you to Forever Stories!\n\nYour invite code: ${inviteCode}\n\nDownload the app and enter this code to view their stories and ask questions.\n\nExpires in 30 days. Reply STOP to opt out.`;

  await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: recipientPhone
  });

  console.log('📱 Invite SMS sent to:', recipientPhone);
}

// Helper: Send reverse invite email (viewer inviting story owner)
async function sendReverseInviteEmail(recipientEmail, inviteCode, viewerName) {
  if (!process.env.RESEND_API_KEY) {
    console.log('📧 Email not configured, skipping reverse invite email send (code:', inviteCode, ')');
    return;
  }

  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.EMAIL_FROM || 'noreply@foreverstories.co';

  await resend.emails.send({
    from: fromEmail,
    to: [recipientEmail],
    subject: `${viewerName} wants to connect with you on Forever Stories`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e11d48;">You've been invited to Forever Stories</h2>
        <p><strong>${viewerName}</strong> wants to hear your stories and memories!</p>
        <p>They've invited you to join Forever Stories, where you can preserve your life stories and share them with family.</p>

        <div style="background-color: #fef2f2; border-left: 4px solid #e11d48; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #666;">Your invite code:</p>
          <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #e11d48; letter-spacing: 2px;">${inviteCode}</p>
        </div>

        <p><strong>How to get started:</strong></p>
        <ol>
          <li>Download the Forever Stories app</li>
          <li>Create your account and select "For Myself"</li>
          <li>Enter this invite code when prompted</li>
          <li>Start sharing your stories with ${viewerName}!</li>
        </ol>

        <p style="color: #666; font-size: 14px; margin-top: 30px;">This invite code expires in 30 days.</p>
      </div>
    `
  });

  console.log('📧 Reverse invite email sent to:', recipientEmail);
}

// Helper: Send reverse invite SMS (viewer inviting story owner)
async function sendReverseInviteSMS(recipientPhone, inviteCode, viewerName) {
  if (!twilioClient) {
    console.log('📱 SMS not configured, skipping reverse invite SMS send (code:', inviteCode, ')');
    return;
  }

  const message = `${viewerName} wants to hear your stories!\n\nThey've invited you to Forever Stories. Download the app, create your account, and use this code:\n\n${inviteCode}\n\nThis connects you so ${viewerName} can read your life stories.\n\nExpires in 30 days.`;

  await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: recipientPhone
  });

  console.log('📱 Reverse invite SMS sent to:', recipientPhone);
}

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Allow external connections

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for static HTML pages
}));

const allowedOrigins = [
  'https://www.foreverstories.co',
  'https://foreverstories.co',
  'https://distinguished-beauty-production-1e26.up.railway.app'
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, true); // Allow all for now since mobile app doesn't send origin
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: { error: 'Too many signup attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Serve static files from public folder
const path = require('path');
app.use(express.static('public'));

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

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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
// LEGAL PAGES (for SMS compliance)
// ============================================================================

// Privacy Policy
// Legal Pages - Serve comprehensive HTML files
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/terms-of-service', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/download', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

app.get('/sms-terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sms-terms.html'));
});
app.get('/sms-opt-in', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sms-opt-in.html'));
});

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

// Register new user
// Signup/Register handler function
const handleSignup = async (req, res) => {
  try {
    console.log('=== SIGNUP REQUEST RECEIVED ===');
    console.log('Email:', req.body.email);
    const { email, password, fullName, role, reverseInviteCode, termsAccepted } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (!/\d/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }

    if (!termsAccepted) {
      return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy' });
    }

    // Check if user exists (case-insensitive)
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with specified role (defaults to 'owner')
    // Spec: All new signups are Owners who can create stories (unless specified as viewer for testing)
    const userRole = role && (role === 'viewer' || role === 'owner') ? role : 'owner';

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, terms_accepted_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
       RETURNING id, email, full_name, role`,
      [email, hashedPassword, fullName, userRole]
    );

    const user = result.rows[0];

    // Create user profile
    await pool.query(
      'INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [user.id]
    );

    // Create user stats
    await pool.query(
      'INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [user.id]
    );

    // Handle reverse invite code if owner provided one
    let reverseInviteUsed = false;
    let viewerName = null;

    if (reverseInviteCode && userRole === 'owner') {
      try {
        // Look up reverse invite token
        const inviteResult = await pool.query(
          `SELECT * FROM reverse_invite_tokens
           WHERE invite_code = $1 AND is_active = TRUE AND expires_at > NOW()`,
          [reverseInviteCode.toUpperCase()]
        );

        if (inviteResult.rows.length > 0) {
          const invite = inviteResult.rows[0];
          const viewerId = invite.viewer_id;

          // Get viewer's name and email
          const viewerResult = await pool.query(
            'SELECT full_name, email FROM users WHERE id = $1',
            [viewerId]
          );

          if (viewerResult.rows.length > 0) {
            viewerName = viewerResult.rows[0].full_name;
            const viewerEmail = viewerResult.rows[0].email;

            // Create access grant (viewer can now see owner's stories)
            await pool.query(
              `INSERT INTO access_grants (owner_id, recipient_user_id, recipient_email, access_level, granted_by, granted_at, invited_via_code)
               VALUES ($1, $2, $3, 'full', $1, NOW(), $4)`,
              [user.id, viewerId, viewerEmail, reverseInviteCode.toUpperCase()]
            );

            // Mark reverse invite as used
            await pool.query(
              `UPDATE reverse_invite_tokens
               SET used_at = NOW(), used_by_owner_id = $1, is_active = FALSE
               WHERE id = $2`,
              [user.id, invite.id]
            );

            reverseInviteUsed = true;
            console.log(`✅ Owner ${user.full_name} connected to viewer ${viewerName} via reverse invite`);
          }
        } else {
          console.log(`⚠️ Invalid or expired reverse invite code: ${reverseInviteCode}`);
        }
      } catch (inviteError) {
        console.error('Error processing reverse invite:', inviteError);
        // Don't fail signup if reverse invite processing fails
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const response = {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    };

    // Add reverse invite info if applicable
    if (reverseInviteUsed) {
      response.reverseInviteUsed = true;
      response.viewerName = viewerName;
    }

    // Send welcome email (async, don't wait for it)
    console.log(`📧 Attempting to send welcome email to: ${user.email}, name: ${user.full_name}`);
    sendWelcomeEmail(user.email, user.full_name)
      .then(result => {
        if (result.success) {
          console.log(`✅ Welcome email sent successfully to ${user.email}. MessageId: ${result.messageId}`);
        } else {
          console.error(`❌ Welcome email failed for ${user.email}:`, result.error);
        }
      })
      .catch(err => {
        console.error(`❌ Exception sending welcome email to ${user.email}:`, err);
      });

    res.json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

app.post('/api/auth/register', signupLimiter, handleSignup);
app.post('/api/auth/signup', signupLimiter, handleSignup);

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user (case-insensitive email lookup)
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
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
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
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
    const { birthDate, birthLocation, lifeEvents, interests, timezone } = req.body;
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
         SET birth_date = $1, birth_location = $2, life_events = $3, interests = $4, timezone = $5, updated_at = NOW()
         WHERE user_id = $6
         RETURNING *`,
        [birthDate, birthLocation, JSON.stringify(lifeEvents), JSON.stringify(interests), timezone || 'America/Phoenix', userId]
      );
      res.json({ success: true, profile: result.rows[0] });
    } else {
      // Create new profile
      const result = await pool.query(
        `INSERT INTO user_profiles (user_id, birth_date, birth_location, life_events, interests, timezone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [userId, birthDate, birthLocation, JSON.stringify(lifeEvents), JSON.stringify(interests), timezone || 'America/Phoenix']
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
// ACCOUNT MANAGEMENT
// ============================================================================

// Get full user account information
app.get('/api/user/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user data and profile data with JOIN
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.created_at,
              p.birth_date, p.birth_location, p.life_events, p.interests,
              p.timezone, p.additional_info
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const account = result.rows[0];

    // Parse JSON fields
    if (account.life_events && typeof account.life_events === 'string') {
      account.life_events = JSON.parse(account.life_events);
    }
    if (account.interests && typeof account.interests === 'string') {
      account.interests = JSON.parse(account.interests);
    }
    if (account.additional_info && typeof account.additional_info === 'string') {
      account.additional_info = JSON.parse(account.additional_info);
    }

    res.json({ account });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// Update basic account information (name, email)
app.put('/api/user/account/basic', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, email } = req.body;

    // Check if email is being changed and if it's already taken
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (fullName !== undefined) {
      updates.push(`full_name = $${paramCount}`);
      values.push(fullName);
      paramCount++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, full_name
    `;

    const result = await pool.query(query, values);
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Update basic info error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Update password
app.put('/api/user/account/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Update profile details
app.put('/api/user/account/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { birthDate, birthLocation, timezone, lifeEvents, interests, additionalInfo } = req.body;

    // Check if profile exists
    const profileCheck = await pool.query(
      'SELECT id FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    const profileExists = profileCheck.rows.length > 0;

    if (profileExists) {
      // Update existing profile
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (birthDate !== undefined) {
        updates.push(`birth_date = $${paramCount}`);
        values.push(birthDate);
        paramCount++;
      }

      if (birthLocation !== undefined) {
        updates.push(`birth_location = $${paramCount}`);
        values.push(birthLocation);
        paramCount++;
      }

      if (timezone !== undefined) {
        updates.push(`timezone = $${paramCount}`);
        values.push(timezone);
        paramCount++;
      }

      if (lifeEvents !== undefined) {
        updates.push(`life_events = $${paramCount}`);
        values.push(JSON.stringify(lifeEvents));
        paramCount++;
      }

      if (interests !== undefined) {
        updates.push(`interests = $${paramCount}`);
        values.push(JSON.stringify(interests));
        paramCount++;
      }

      if (additionalInfo !== undefined) {
        updates.push(`additional_info = $${paramCount}`);
        values.push(JSON.stringify(additionalInfo));
        paramCount++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE user_profiles
        SET ${updates.join(', ')}
        WHERE user_id = $${paramCount}
        RETURNING *
      `;

      const result = await pool.query(query, values);
      res.json({ success: true, profile: result.rows[0] });
    } else {
      // Insert new profile
      const result = await pool.query(
        `INSERT INTO user_profiles (user_id, birth_date, birth_location, timezone, life_events, interests, additional_info)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userId,
          birthDate || null,
          birthLocation || null,
          timezone || 'America/Phoenix',
          JSON.stringify(lifeEvents || []),
          JSON.stringify(interests || []),
          JSON.stringify(additionalInfo || {})
        ]
      );

      res.json({ success: true, profile: result.rows[0] });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete account and all associated data
app.delete('/api/user/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log(`🗑️  Account deletion requested for user: ${userId}`);

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Delete in order to respect foreign key constraints

      console.log('1. Deleting response files...');
      await pool.query(
        'DELETE FROM response_files WHERE response_id IN (SELECT id FROM prompt_responses WHERE user_id = $1)',
        [userId]
      );

      console.log('2. Deleting user files...');
      await pool.query('DELETE FROM user_files WHERE user_id = $1', [userId]);

      console.log('3. Deleting prompt responses...');
      await pool.query('DELETE FROM prompt_responses WHERE user_id = $1', [userId]);

      console.log('4. Deleting submitted questions (as submitter)...');
      await pool.query('DELETE FROM submitted_questions WHERE submitter_user_id = $1', [userId]);

      console.log('5. Deleting submitted questions (as story owner)...');
      await pool.query('DELETE FROM submitted_questions WHERE story_owner_id = $1', [userId]);

      console.log('6. Deleting access grants (owner and recipient)...');
      await pool.query(
        'DELETE FROM access_grants WHERE owner_id = $1 OR recipient_user_id = $1',
        [userId]
      );

      console.log('6b. Deleting access grants (granted_by - may not exist)...');
      await pool.query('DELETE FROM access_grants WHERE granted_by = $1', [userId]).catch((e) => {
        console.log('granted_by column does not exist, skipping...');
      });

      console.log('8. Deleting reverse invite tokens (viewer_id)...');
      await pool.query('DELETE FROM reverse_invite_tokens WHERE viewer_id = $1', [userId]).catch((e) => {
        console.log('reverse_invite_tokens table does not exist, skipping...');
      });

      console.log('8b. Deleting reverse invite tokens (used_by_owner_id - may not exist)...');
      await pool.query('DELETE FROM reverse_invite_tokens WHERE used_by_owner_id = $1', [userId]).catch((e) => {
        console.log('used_by_owner_id column does not exist, skipping...');
      });

      console.log('9. Deleting invite tokens...');
      await pool.query('DELETE FROM invite_tokens WHERE owner_id = $1 OR used_by_user_id = $1', [userId]).catch(() => {});

      console.log('10. Deleting user stats...');
      await pool.query('DELETE FROM user_stats WHERE user_id = $1', [userId]);

      console.log('11. Deleting notifications...');
      await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);

      console.log('12. Deleting persona conversations...');
      await pool.query('DELETE FROM persona_conversations WHERE user_id = $1', [userId]);

      console.log('13. Deleting persona embeddings...');
      await pool.query('DELETE FROM persona_embeddings WHERE user_id = $1', [userId]);

      console.log('14. Deleting user achievements...');
      await pool.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);

      console.log('15. Deleting push tokens...');
      await pool.query('DELETE FROM push_tokens WHERE user_id = $1', [userId]).catch(() => {});

      console.log('16. Deleting notification preferences...');
      await pool.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]).catch(() => {});

      console.log('17. Deleting notification log...');
      await pool.query('DELETE FROM notification_log WHERE user_id = $1', [userId]).catch(() => {});

      console.log('18. Deleting user prompt affinity...');
      await pool.query('DELETE FROM user_prompt_affinity WHERE user_id = $1', [userId]).catch(() => {});

      console.log('19. Deleting user prompt history...');
      await pool.query('DELETE FROM user_prompt_history WHERE user_id = $1', [userId]).catch(() => {});

      console.log('20. Deleting user daily stats...');
      await pool.query('DELETE FROM user_daily_stats WHERE user_id = $1', [userId]).catch(() => {});

      console.log('21. Deleting prompt ratings...');
      await pool.query('DELETE FROM prompt_ratings WHERE user_id = $1', [userId]).catch(() => {});

      console.log('22. Deleting user suppressed prompts...');
      await pool.query('DELETE FROM user_suppressed_prompts WHERE user_id = $1', [userId]).catch(() => {});

      console.log('23. Deleting user unlocked gates...');
      await pool.query('DELETE FROM user_unlocked_gates WHERE user_id = $1', [userId]).catch(() => {});

      console.log('24. Deleting user profile...');
      await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);

      console.log('25. Finally, deleting the user...');
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);

      // Commit transaction
      await pool.query('COMMIT');

      console.log(`✅ Account deleted successfully: ${userId}`);

      res.json({
        success: true,
        message: 'Account and all associated data have been permanently deleted'
      });
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      console.error('❌ Transaction error:', error);
      console.error('Error detail:', error.detail);
      console.error('Error table:', error.table);
      console.error('Error constraint:', error.constraint);
      throw error;
    }
  } catch (error) {
    console.error('Delete account error:', error);
    console.error('Error message:', error.message);
    console.error('Error detail:', error.detail);
    console.error('Error constraint:', error.constraint);
    res.status(500).json({
      error: 'Failed to delete account. Please try again or contact support.'
    });
  }
});

// ============================================================================
// FAMILY/FRIENDS ACCESS MANAGEMENT
// ============================================================================

// Send invitation to family/friend
app.post('/api/access/invite', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { recipientEmail, permissions } = req.body;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Permissions object required' });
    }

    // Check if invitation already exists
    const existingGrant = await pool.query(
      `SELECT id, is_active FROM access_grants
       WHERE owner_id = $1 AND recipient_email = $2`,
      [ownerId, recipientEmail]
    );

    if (existingGrant.rows.length > 0) {
      const grant = existingGrant.rows[0];
      if (grant.is_active) {
        return res.status(400).json({ error: 'Access already granted to this email' });
      }
      // Reactivate existing grant
      const result = await pool.query(
        `UPDATE access_grants
         SET permissions = $1, is_active = true, granted_at = NOW(), revoked_at = NULL
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(permissions), grant.id]
      );
      return res.json({ success: true, grant: result.rows[0] });
    }

    // Check if recipient has an account
    const recipientUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [recipientEmail]
    );

    const recipientUserId = recipientUser.rows[0]?.id || null;

    // Create new access grant
    const result = await pool.query(
      `INSERT INTO access_grants (owner_id, recipient_email, recipient_user_id, access_level, permissions, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [ownerId, recipientEmail, recipientUserId, 'custom', JSON.stringify(permissions)]
    );

    res.json({
      success: true,
      grant: result.rows[0],
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Get all access grants (people you've granted access to)
app.get('/api/access/grants', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT ag.id, ag.recipient_email, ag.permissions, ag.granted_at, ag.is_active,
              u.full_name as recipient_name
       FROM access_grants ag
       LEFT JOIN users u ON ag.recipient_user_id = u.id
       WHERE ag.owner_id = $1 AND ag.is_active = true
       ORDER BY ag.granted_at DESC`,
      [ownerId]
    );

    // Parse permissions JSON
    const grants = result.rows.map(grant => ({
      ...grant,
      permissions: typeof grant.permissions === 'string'
        ? JSON.parse(grant.permissions)
        : grant.permissions
    }));

    res.json({ grants });
  } catch (error) {
    console.error('Get grants error:', error);
    res.status(500).json({ error: 'Failed to get access grants' });
  }
});

// Update permissions for existing grant
app.put('/api/access/grant/:grantId', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { grantId } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Permissions object required' });
    }

    // Verify owner
    const grantCheck = await pool.query(
      'SELECT owner_id FROM access_grants WHERE id = $1',
      [grantId]
    );

    if (grantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Access grant not found' });
    }

    if (grantCheck.rows[0].owner_id !== ownerId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Update permissions
    const result = await pool.query(
      `UPDATE access_grants
       SET permissions = $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(permissions), grantId]
    );

    res.json({ success: true, grant: result.rows[0] });
  } catch (error) {
    console.error('Update grant error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Revoke access (soft delete)
app.delete('/api/access/grant/:grantId', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { grantId } = req.params;

    // Verify owner
    const grantCheck = await pool.query(
      'SELECT owner_id FROM access_grants WHERE id = $1',
      [grantId]
    );

    if (grantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Access grant not found' });
    }

    if (grantCheck.rows[0].owner_id !== ownerId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Soft delete
    await pool.query(
      `UPDATE access_grants
       SET is_active = false, revoked_at = NOW()
       WHERE id = $1`,
      [grantId]
    );

    res.json({ success: true, message: 'Access revoked successfully' });
  } catch (error) {
    console.error('Revoke access error:', error);
    res.status(500).json({ error: 'Failed to revoke access' });
  }
});

// Get accounts where current user has been granted access
app.get('/api/access/my-access', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;

    const result = await pool.query(
      `SELECT ag.id, ag.owner_id, ag.permissions, ag.granted_at,
              u.full_name as owner_name, u.email as owner_email
       FROM access_grants ag
       JOIN users u ON ag.owner_id = u.id
       WHERE (ag.recipient_user_id = $1 OR ag.recipient_email = $2)
         AND ag.is_active = true
       ORDER BY ag.granted_at DESC`,
      [userId, userEmail]
    );

    // Parse permissions JSON
    const accessList = result.rows.map(access => ({
      ...access,
      permissions: typeof access.permissions === 'string'
        ? JSON.parse(access.permissions)
        : access.permissions
    }));

    res.json({ accessList });
  } catch (error) {
    console.error('Get my access error:', error);
    res.status(500).json({ error: 'Failed to get access list' });
  }
});

// ============================================================================
// INVITE SYSTEM (PHASE 2)
// ============================================================================

// Owner sends invite to family member
app.post('/api/invites/send', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { method, recipientEmail, recipientPhone } = req.body;

    // Validate method
    const deliveryMethod = method || 'email';
    if (!['email', 'sms'].includes(deliveryMethod)) {
      return res.status(400).json({ error: 'Invalid method. Must be "email" or "sms"' });
    }

    // Validate recipient based on method
    if (deliveryMethod === 'email') {
      if (!recipientEmail || !recipientEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid email address required' });
      }
    } else if (deliveryMethod === 'sms') {
      if (!recipientPhone) {
        return res.status(400).json({ error: 'Phone number required for SMS' });
      }
      // Validate phone has at least 10 digits
      const digits = recipientPhone.replace(/\D/g, '');
      if (digits.length < 10) {
        return res.status(400).json({ error: 'Phone number must have at least 10 digits' });
      }
    }

    // Verify user is an Owner
    const ownerCheck = await pool.query(
      'SELECT role, full_name FROM users WHERE id = $1',
      [ownerId]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can send invites' });
    }

    const ownerName = ownerCheck.rows[0].full_name;

    // Generate unique invite code
    let inviteCode;
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existing = await pool.query(
        'SELECT id FROM invite_tokens WHERE invite_code = $1',
        [inviteCode]
      );
      isUnique = existing.rows.length === 0;
    }

    // Create invite token (expires in 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `INSERT INTO invite_tokens
       (owner_id, invite_code, recipient_email, expires_at, delivery_method)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        ownerId,
        inviteCode,
        deliveryMethod === 'email' ? recipientEmail.toLowerCase() : recipientPhone,
        expiresAt,
        deliveryMethod
      ]
    );

    // Send push notification if viewer already has an account
    if (deliveryMethod === 'email') {
      sendInviteNotification(pool, recipientEmail.toLowerCase(), ownerName, inviteCode)
        .catch(err => console.error('Failed to send invite notification:', err));
    }

    // Send invite via chosen method (will skip if not configured)
    let sendSuccess = false;
    let sendError = null;
    try {
      if (deliveryMethod === 'email') {
        console.log(`📧 Attempting to send invite email to: ${recipientEmail}, from: ${ownerName}, code: ${inviteCode}`);
        const result = await sendInviteEmail(recipientEmail, ownerName, inviteCode);
        console.log(`✅ Invite email sent successfully to ${recipientEmail}. MessageId: ${result.messageId}`);
      } else {
        await sendInviteSMS(recipientPhone, inviteCode, ownerName);
      }
      sendSuccess = true;
    } catch (error) {
      console.error(`❌ ${deliveryMethod.toUpperCase()} send failed to ${deliveryMethod === 'email' ? recipientEmail : recipientPhone}:`, error);
      sendError = error.message || 'Failed to send invitation';
      // If SMS/email is not configured, we'll still return success with a warning
      // But if it's configured and fails, return error
      if (deliveryMethod === 'sms' && process.env.TWILIO_ACCOUNT_SID) {
        return res.status(500).json({ error: sendError });
      }
      if (deliveryMethod === 'email' && process.env.RESEND_API_KEY) {
        return res.status(500).json({ error: sendError });
      }
    }

    res.json({
      success: true,
      inviteCode,
      method: deliveryMethod,
      message: sendSuccess ? `Invitation sent via ${deliveryMethod}` : `Invitation created (${deliveryMethod} not configured)`
    });
  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Viewer (child) invites owner (parent) - REVERSE INVITE FLOW
app.post('/api/invites/send-reverse', authenticateToken, async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { method, recipientEmail, recipientPhone } = req.body;

    // Validate method
    const deliveryMethod = method || 'email';
    if (!['email', 'sms'].includes(deliveryMethod)) {
      return res.status(400).json({ error: 'Invalid method. Must be "email" or "sms"' });
    }

    // Validate recipient based on method
    if (deliveryMethod === 'email') {
      if (!recipientEmail || !recipientEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid email address required' });
      }
    } else if (deliveryMethod === 'sms') {
      if (!recipientPhone) {
        return res.status(400).json({ error: 'Phone number required for SMS' });
      }
    }

    // Verify user is a Viewer
    const viewerCheck = await pool.query(
      'SELECT role, full_name FROM users WHERE id = $1',
      [viewerId]
    );

    if (viewerCheck.rows.length === 0 || viewerCheck.rows[0].role !== 'viewer') {
      return res.status(403).json({ error: 'Only viewers can send invites' });
    }

    const viewerName = viewerCheck.rows[0].full_name;

    // Generate unique invite code
    let inviteCode;
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existing = await pool.query(
        'SELECT id FROM reverse_invite_tokens WHERE invite_code = $1',
        [inviteCode]
      );
      isUnique = existing.rows.length === 0;
    }

    // Create reverse invite token (expires in 30 days)
    // This will be used by the parent when they sign up
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `INSERT INTO reverse_invite_tokens
       (viewer_id, invite_code, recipient_email, recipient_phone, expires_at, delivery_method)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        viewerId,
        inviteCode,
        deliveryMethod === 'email' ? recipientEmail.toLowerCase() : null,
        deliveryMethod === 'sms' ? recipientPhone : null,
        expiresAt,
        deliveryMethod
      ]
    );

    // Send push notification if recipient already has an account
    if (deliveryMethod === 'email') {
      sendInviteNotification(pool, recipientEmail.toLowerCase(), viewerName, inviteCode, true)
        .catch(err => console.error('Failed to send reverse invite notification:', err));
    }

    // Send invite via chosen method
    try {
      if (deliveryMethod === 'email') {
        await sendReverseInviteEmail(recipientEmail, inviteCode, viewerName);
      } else {
        await sendReverseInviteSMS(recipientPhone, inviteCode, viewerName);
      }
    } catch (sendError) {
      console.error(`${deliveryMethod.toUpperCase()} send failed:`, sendError);
      // Don't fail the request if send fails - user can still use the code
    }

    res.json({
      success: true,
      inviteCode,
      method: deliveryMethod,
      message: `Invitation sent via ${deliveryMethod}`
    });
  } catch (error) {
    console.error('Send reverse invite error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Viewer accepts invite
app.post('/api/invites/accept', authenticateToken, async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required' });
    }

    // Verify user is a Viewer
    const viewerCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [viewerId]
    );

    if (viewerCheck.rows.length === 0 || viewerCheck.rows[0].role !== 'viewer') {
      return res.status(403).json({ error: 'Only viewers can accept invites' });
    }

    // Find and validate invite token
    const inviteResult = await pool.query(
      `SELECT * FROM invite_tokens
       WHERE invite_code = $1 AND is_active = TRUE`,
      [inviteCode.toUpperCase()]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invite code' });
    }

    const invite = inviteResult.rows[0];

    // Check if already used
    if (invite.used_at) {
      return res.status(400).json({ error: 'This invite has already been used' });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invite has expired' });
    }

    // Check if access already exists
    const existingAccess = await pool.query(
      `SELECT id FROM access_grants
       WHERE owner_id = $1 AND recipient_user_id = $2`,
      [invite.owner_id, viewerId]
    );

    if (existingAccess.rows.length > 0) {
      return res.status(400).json({ error: 'You already have access to this account' });
    }

    // Get viewer email
    const viewerEmail = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [viewerId]
    );

    // Create access grant (access is ON by default for invites)
    await pool.query(
      `INSERT INTO access_grants
       (owner_id, recipient_email, recipient_user_id, is_active, invited_via_code, invited_at, access_granted_at, granted_at)
       VALUES ($1, $2, $3, TRUE, $4, NOW(), NOW(), NOW())`,
      [invite.owner_id, viewerEmail.rows[0].email, viewerId, inviteCode.toUpperCase()]
    );

    // Mark invite as used
    await pool.query(
      `UPDATE invite_tokens
       SET used_at = NOW(), used_by_user_id = $1, is_active = FALSE
       WHERE id = $2`,
      [viewerId, invite.id]
    );

    // Get owner info
    const ownerInfo = await pool.query(
      'SELECT full_name FROM users WHERE id = $1',
      [invite.owner_id]
    );

    res.json({
      success: true,
      message: `You now have access to ${ownerInfo.rows[0].full_name}'s stories`,
      ownerId: invite.owner_id,
      ownerName: ownerInfo.rows[0].full_name
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Owner views sent invites
app.get('/api/invites/my-invites', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT
        id,
        invite_code,
        recipient_email,
        created_at,
        expires_at,
        used_at,
        is_active
       FROM invite_tokens
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [ownerId]
    );

    res.json({
      invites: result.rows
    });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ error: 'Failed to get invites' });
  }
});

// Owner views who has access (viewers)
app.get('/api/access/my-viewers', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT
        ag.id as grant_id,
        ag.is_active,
        ag.access_granted_at,
        ag.revoked_at,
        u.id as viewer_id,
        u.email as viewer_email,
        u.full_name as viewer_name
       FROM access_grants ag
       JOIN users u ON ag.recipient_user_id = u.id
       WHERE ag.owner_id = $1
       ORDER BY ag.access_granted_at DESC`,
      [ownerId]
    );

    res.json({
      viewers: result.rows
    });
  } catch (error) {
    console.error('Get viewers error:', error);
    res.status(500).json({ error: 'Failed to get viewers' });
  }
});

// Viewer gets list of all owners they have access to
app.get('/api/viewers/my-owners', authenticateToken, async (req, res) => {
  try {
    const viewerId = req.user.userId;

    // Verify user is a viewer
    const userCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [viewerId]
    );

    if (userCheck.rows[0]?.role !== 'viewer') {
      return res.status(403).json({ error: 'Only viewers can access this endpoint' });
    }

    // Get all owners this viewer has access to
    const result = await pool.query(
      `SELECT
        ag.owner_id,
        ag.is_active,
        ag.access_granted_at,
        u.full_name as owner_name,
        u.email as owner_email
       FROM access_grants ag
       JOIN users u ON ag.owner_id = u.id
       WHERE ag.recipient_user_id = $1
         AND ag.is_active = TRUE
         AND ag.revoked_at IS NULL
       ORDER BY ag.access_granted_at DESC`,
      [viewerId]
    );

    res.json({ owners: result.rows });
  } catch (error) {
    console.error('Get my owners error:', error);
    res.status(500).json({ error: 'Failed to load owners' });
  }
});

// Owner toggles viewer access ON/OFF
app.put('/api/access/toggle/:grantId', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { grantId } = req.params;

    // Verify ownership
    const grant = await pool.query(
      'SELECT * FROM access_grants WHERE id = $1 AND owner_id = $2',
      [grantId, ownerId]
    );

    if (grant.rows.length === 0) {
      return res.status(404).json({ error: 'Access grant not found' });
    }

    const currentlyActive = grant.rows[0].is_active;

    // Toggle access
    await pool.query(
      `UPDATE access_grants
       SET is_active = $1,
           revoked_at = CASE WHEN $1 = FALSE THEN NOW() ELSE NULL END
       WHERE id = $2`,
      [!currentlyActive, grantId]
    );

    res.json({
      success: true,
      isActive: !currentlyActive,
      message: !currentlyActive ? 'Access restored' : 'Access revoked'
    });
  } catch (error) {
    console.error('Toggle access error:', error);
    res.status(500).json({ error: 'Failed to toggle access' });
  }
});

// ============================================================================
// QUESTION SUBMISSION SYSTEM
// ============================================================================

// Submit question for story owner
app.post('/api/questions/submit', authenticateToken, async (req, res) => {
  try {
    const submitterId = req.user.userId;
    const submitterEmail = req.user.email;
    const { ownerId, questionText } = req.body;

    if (!ownerId || !questionText || !questionText.trim()) {
      return res.status(400).json({ error: 'Owner ID and question text required' });
    }

    // Verify submitter has active access to this owner (Phase 1: binary access model)
    const accessCheck = await pool.query(
      `SELECT id FROM access_grants
       WHERE owner_id = $1
         AND recipient_user_id = $2
         AND is_active = TRUE
         AND revoked_at IS NULL`,
      [ownerId, submitterId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to submit questions to this owner' });
    }

    // SPEC REQUIREMENT: Enforce 3 pending question limit per owner
    const pendingCount = await pool.query(
      `SELECT COUNT(*) as count
       FROM submitted_questions
       WHERE story_owner_id = $1 AND status = 'pending'`,
      [ownerId]
    );

    const currentPending = parseInt(pendingCount.rows[0].count);

    if (currentPending >= 3) {
      return res.status(400).json({
        error: 'Maximum 3 pending questions reached. Please wait for the owner to answer existing questions.',
        pendingCount: currentPending
      });
    }

    // Insert question
    const result = await pool.query(
      `INSERT INTO submitted_questions (story_owner_id, submitter_user_id, submitter_email, question_text, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING *`,
      [ownerId, submitterId, submitterEmail, questionText.trim()]
    );

    // Get submitter name for notification
    const submitterResult = await pool.query(
      'SELECT full_name FROM users WHERE id = $1',
      [submitterId]
    );
    const submitterName = submitterResult.rows[0]?.full_name || submitterEmail;

    // Send push notification to owner
    sendFamilyQuestionNotification(pool, ownerId, submitterName, result.rows[0].id)
      .catch(err => console.error('Failed to send question notification:', err));

    res.json({
      success: true,
      question: result.rows[0],
      message: 'Question submitted successfully',
      pendingCount: currentPending + 1
    });
  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

// Get pending questions count for owner (Phase 3)
app.get('/api/questions/pending-count', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM submitted_questions
       WHERE story_owner_id = $1 AND status = 'pending'`,
      [ownerId]
    );

    res.json({
      count: parseInt(result.rows[0].count)
    });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ error: 'Failed to get pending count' });
  }
});

// Get pending questions list for owner (Phase 3)
app.get('/api/questions/pending', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT
        sq.id,
        sq.question_text,
        sq.submitter_email,
        sq.created_at,
        u.full_name as submitter_name
       FROM submitted_questions sq
       LEFT JOIN users u ON sq.submitter_user_id = u.id
       WHERE sq.story_owner_id = $1 AND sq.status = 'pending'
       ORDER BY sq.created_at ASC`,
      [ownerId]
    );

    res.json({
      questions: result.rows
    });
  } catch (error) {
    console.error('Get pending questions error:', error);
    res.status(500).json({ error: 'Failed to get pending questions' });
  }
});

// Get questions - for owners: questions submitted TO them, for viewers: questions they submitted
app.get('/api/questions/submitted', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let result;

    if (userRole === 'viewer') {
      // For viewers: show questions they submitted to owners
      result = await pool.query(
        `SELECT sq.id, sq.question_text, sq.status, sq.created_at, sq.used_as_prompt_at,
                sq.submitter_email, owner.full_name as recipient_name
         FROM submitted_questions sq
         LEFT JOIN users owner ON sq.story_owner_id = owner.id
         WHERE sq.submitter_user_id = $1
         ORDER BY sq.created_at DESC`,
        [userId]
      );
    } else {
      // For owners: show questions submitted to them
      result = await pool.query(
        `SELECT sq.id, sq.question_text, sq.status, sq.created_at, sq.used_as_prompt_at,
                sq.submitter_email, u.full_name as submitter_name
         FROM submitted_questions sq
         LEFT JOIN users u ON sq.submitter_user_id = u.id
         WHERE sq.story_owner_id = $1
         ORDER BY sq.created_at DESC`,
        [userId]
      );
    }

    res.json({ questions: result.rows });
  } catch (error) {
    console.error('Get submitted questions error:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Delete/reject submitted question
app.delete('/api/questions/:questionId', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { questionId } = req.params;

    // Verify owner
    const questionCheck = await pool.query(
      'SELECT story_owner_id FROM submitted_questions WHERE id = $1',
      [questionId]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (questionCheck.rows[0].story_owner_id !== ownerId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Delete question
    await pool.query('DELETE FROM submitted_questions WHERE id = $1', [questionId]);

    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Get a specific submitted question by ID
app.get('/api/questions/question/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questionId } = req.params;

    const result = await pool.query(
      `SELECT
        sq.id,
        sq.question_text as prompt_text,
        sq.submitter_email,
        sq.submitter_user_id,
        sq.story_owner_id
       FROM submitted_questions sq
       WHERE sq.id = $1 AND sq.status = 'pending'`,
      [questionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found or already answered' });
    }

    const question = result.rows[0];

    // Verify user is the story owner
    if (question.story_owner_id !== userId) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Get submitter name if available
    let submitterName = question.submitter_email;
    if (question.submitter_user_id) {
      const submitterResult = await pool.query(
        'SELECT full_name FROM users WHERE id = $1',
        [question.submitter_user_id]
      );
      if (submitterResult.rows.length > 0) {
        submitterName = submitterResult.rows[0].full_name;
      }
    }

    res.json({
      prompt: {
        id: `submitted_${question.id}`,
        question: question.prompt_text,
        category: 'Family Question',
        type: 'submitted',
        submitterInfo: {
          name: submitterName
        },
        submittedQuestionId: question.id,
        domain: 'Relationships',
        story_type: 'Love & Connection',
        emotional_weight: 'Medium'
      }
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ error: 'Failed to get question' });
  }
});

// ============================================================================
// FILE UPLOADS
// ============================================================================

// Upload files (photos/videos) and return file IDs
app.post('/api/files/upload', authenticateToken, (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);

      // Handle multer-specific errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 100MB limit' });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Maximum 10 files allowed per upload' });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Unexpected file field' });
        }
      }

      // Handle custom file filter errors
      if (err.message.includes('Invalid file type')) {
        return res.status(400).json({ error: err.message });
      }

      return res.status(500).json({ error: err.message || 'File upload failed' });
    }

    // No error, continue to the actual handler
    next();
  });
}, async (req, res) => {
  try {
    const userId = req.user.userId;
    const uploadedFiles = req.files;

    console.log('FILE UPLOAD - User ID:', userId);
    console.log('FILE UPLOAD - Number of files:', uploadedFiles?.length || 0);

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const fileRecords = [];

    for (const file of uploadedFiles) {
      console.log('FILE UPLOAD - Processing file:', file.originalname);
      // Upload to S3
      const s3Key = await uploadToS3(file, userId);
      console.log('FILE UPLOAD - S3 key:', s3Key);

      // Extract metadata
      const metadata = {
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      };

      // Save to database
      const result = await pool.query(
        `INSERT INTO user_files
        (user_id, filename, file_path, file_type, file_size, metadata, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *`,
        [userId, file.originalname, s3Key, file.mimetype, file.size, JSON.stringify(metadata)]
      );

      console.log('FILE UPLOAD - Saved to DB with ID:', result.rows[0].id);
      fileRecords.push(result.rows[0]);
    }

    console.log('FILE UPLOAD - Returning', fileRecords.length, 'file records');
    console.log('FILE UPLOAD - File IDs:', fileRecords.map(f => f.id));

    res.json({
      success: true,
      files: fileRecords
    });
  } catch (error) {
    console.error('File upload error:', error);

    let errorMessage = 'Failed to upload files';
    if (error.message && (error.message.includes('size') || error.message.includes('limit'))) {
      errorMessage = 'File size exceeds 100MB limit';
    }

    res.status(500).json({ error: errorMessage });
  }
});

// ============================================================================
// DAILY PROMPTS
// ============================================================================

// Get today's prompt for user (UPDATED)
app.get('/api/prompts/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's timezone from profile, default to America/Phoenix if not set
    const userProfile = await pool.query(
      'SELECT timezone FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const userTimezone = userProfile.rows[0]?.timezone || 'America/Phoenix';

    // Get today's date in user's local timezone using Intl API
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayDate = formatter.format(now); // Returns YYYY-MM-DD format

    console.log('=== GET TODAY PROMPT ===');
    console.log('User ID:', userId);
    console.log('User Timezone:', userTimezone);
    console.log('Today Date (calculated):', todayDate);
    console.log('Current UTC:', now.toISOString());

    // Get user's onboarding status
    const userResult = await pool.query(
      'SELECT first_system_prompt_completed FROM users WHERE id = $1',
      [userId]
    );
    const hasCompletedOnboarding = userResult.rows[0]?.first_system_prompt_completed || false;
    console.log('Has completed onboarding:', hasCompletedOnboarding);

    // STEP 1: Check for submitted questions (only if onboarding complete)
    // Spec: "Family questions must not appear during onboarding"
    // Spec: "They become eligible only after the owner has completed or skipped at least one system prompt"
    let submittedQuestion = { rows: [] };

    if (hasCompletedOnboarding) {
      submittedQuestion = await pool.query(
        `SELECT id, question_text as prompt_text, submitter_email, submitter_user_id
         FROM submitted_questions
         WHERE story_owner_id = $1 AND status = 'pending'
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
      );
    } else {
      console.log('Skipping family questions - user has not completed onboarding');
    }

    if (submittedQuestion.rows.length > 0) {
      const question = submittedQuestion.rows[0];

      // Get submitter name if available
      let submitterName = question.submitter_email;
      if (question.submitter_user_id) {
        const submitterResult = await pool.query(
          'SELECT full_name FROM users WHERE id = $1',
          [question.submitter_user_id]
        );
        if (submitterResult.rows.length > 0) {
          submitterName = submitterResult.rows[0].full_name;
        }
      }

      return res.json({
        answered: false,
        prompt: {
          id: `submitted_${question.id}`,
          question: question.prompt_text,
          category: 'Family Question',
          type: 'submitted',
          submitterInfo: {
            name: submitterName
          },
          submittedQuestionId: question.id,
          domain: 'Relationships',
          story_type: 'Love & Connection',
          emotional_weight: 'Medium'
        }
      });
    }

    // STEP 2: Check if user already answered a prompt today
    const answeredToday = await pool.query(
      `SELECT pr.*, p.prompt_text, p.domain, p.story_type, p.emotional_weight, p.gate_tag
       FROM prompt_responses pr
       LEFT JOIN prompts p ON pr.prompt_id = p.id
       WHERE pr.user_id = $1
         AND DATE(pr.created_at AT TIME ZONE $2) = $3
       ORDER BY pr.created_at DESC
       LIMIT 1`,
      [userId, userTimezone, todayDate]
    );

    console.log('Answered today query results:', answeredToday.rows.length, 'rows');
    if (answeredToday.rows.length > 0) {
      console.log('Found answer from:', answeredToday.rows[0].created_at);
      console.log('Response text:', answeredToday.rows[0].response_text?.substring(0, 50) + '...');
    }

    if (answeredToday.rows.length > 0) {
      const answered = answeredToday.rows[0];
      return res.json({
        answered: true,
        prompt: {
          id: answered.prompt_id,
          question: answered.prompt_text,
          response: answered.response_text,
          responseId: answered.id,
          domain: answered.domain,
          story_type: answered.story_type,
          emotional_weight: answered.emotional_weight,
          gate_tag: answered.gate_tag
        }
      });
    }

    // STEP 3: Use new weighted prompt selection engine
    const selectedPrompt = await getNextPrompt(pool, userId);
    console.log('Selected prompt result:', selectedPrompt ? { id: selectedPrompt.id, needsChoice: selectedPrompt.needsChoice, question: selectedPrompt.prompt_text?.substring(0, 50) } : 'null/undefined');

    if (selectedPrompt && selectedPrompt.needsChoice) {
      // Handle rescue mode / choice mode from selection engine
      // Return first choice or option as the prompt
      if (selectedPrompt.choices && selectedPrompt.choices.length > 0) {
        const choice = selectedPrompt.choices[0];
        res.json({
          answered: false,
          prompt: {
            id: choice.id,
            question: choice.prompt_text,
            category: choice.domain,
            type: choice.story_type,
            domain: choice.domain,
            story_type: choice.story_type,
            emotional_weight: choice.emotional_weight,
            depth: choice.depth,
            requires_gate: choice.requires_gate,
            gate_tag: choice.gate_tag
          }
        });
      } else {
        // Rescue mode options - just get a new prompt in rescue_light mode
        const rescuePrompt = await getNextPrompt(pool, userId, 'rescue_light');
        if (rescuePrompt && rescuePrompt.id) {
          res.json({
            answered: false,
            prompt: {
              id: rescuePrompt.id,
              question: rescuePrompt.prompt_text,
              category: rescuePrompt.domain,
              type: rescuePrompt.story_type,
              domain: rescuePrompt.domain,
              story_type: rescuePrompt.story_type,
              emotional_weight: rescuePrompt.emotional_weight,
              depth: rescuePrompt.depth,
              requires_gate: rescuePrompt.requires_gate,
              gate_tag: rescuePrompt.gate_tag
            }
          });
        } else {
          res.json({ answered: false, prompt: { id: null, question: "No prompts available right now.", category: "general", type: "reflection" } });
        }
      }
    } else if (selectedPrompt && selectedPrompt.id) {
      res.json({
        answered: false,
        prompt: {
          id: selectedPrompt.id,
          question: selectedPrompt.prompt_text,
          category: selectedPrompt.domain,
          type: selectedPrompt.story_type,
          domain: selectedPrompt.domain,
          story_type: selectedPrompt.story_type,
          emotional_weight: selectedPrompt.emotional_weight,
          depth: selectedPrompt.depth,
          requires_gate: selectedPrompt.requires_gate,
          gate_tag: selectedPrompt.gate_tag
        }
      });
    } else {
      // No prompts available
      console.log('No prompt available for user:', userId);
      res.json({
        answered: false,
        prompt: {
          id: null,
          question: "No prompts available right now.",
          category: "general",
          type: "reflection",
          domain: "Identity",
          story_type: "Reflection & Wisdom",
          emotional_weight: "Light"
        }
      });
    }
  } catch (error) {
    console.error('Get today prompt error:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

// Debug endpoint - check prompt selection state
app.get('/api/prompts/debug', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [totalPrompts, answered, history, recentHistory, suppressed, nonGated, dailyStats, userTz] = await Promise.all([
      pool.query('SELECT COUNT(*) as cnt FROM prompts WHERE is_active = TRUE'),
      pool.query('SELECT COUNT(*) as cnt FROM prompt_responses WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as cnt FROM user_prompt_history WHERE user_id = $1', [userId]),
      pool.query("SELECT COUNT(*) as cnt FROM user_prompt_history WHERE user_id = $1 AND shown_at > NOW() - INTERVAL '15 days'", [userId]),
      pool.query('SELECT * FROM user_suppressed_prompts WHERE user_id = $1', [userId]),
      pool.query('SELECT COUNT(*) as cnt FROM prompts WHERE is_active = TRUE AND requires_gate = FALSE AND id NOT IN (SELECT prompt_id FROM prompt_responses WHERE user_id = $1 AND prompt_id IS NOT NULL)', [userId]),
      pool.query('SELECT * FROM user_daily_stats WHERE user_id = $1 ORDER BY stat_date DESC LIMIT 5', [userId]),
      pool.query('SELECT timezone FROM user_profiles WHERE user_id = $1', [userId]),
    ]);

    res.json({
      active_prompts: totalPrompts.rows[0].cnt,
      prompts_answered: answered.rows[0].cnt,
      total_history_entries: history.rows[0].cnt,
      history_last_15_days: recentHistory.rows[0].cnt,
      suppressed_entries: suppressed.rows,
      non_gated_unanswered: nonGated.rows[0].cnt,
      recent_daily_stats: dailyStats.rows,
      user_timezone: userTz.rows[0]?.timezone || 'not set',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get next prompt (UPDATED for new schema)
app.get('/api/prompts/next', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get prompts user hasn't answered yet (exclude last 30 days)
    const recentPrompts = await pool.query(
      `SELECT prompt_id FROM prompt_responses
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );
    const excludedIds = recentPrompts.rows.map(r => r.prompt_id).filter(id => id);

    let query = `SELECT * FROM prompts WHERE is_active = TRUE`;
    const params = [userId];

    if (excludedIds.length > 0) {
      query += ` AND id NOT IN (${excludedIds.map((_, i) => `$${i + 2}`).join(',')})`;
      params.push(...excludedIds);
    }

    query += ` ORDER BY RANDOM() LIMIT 1`;

    const promptsResult = await pool.query(query, params);

    if (promptsResult.rows.length > 0) {
      const prompt = promptsResult.rows[0];

      res.json({
        prompt: {
          id: prompt.id,
          question: prompt.prompt_text,
          category: prompt.domain,
          type: prompt.story_type,
          domain: prompt.domain,
          story_type: prompt.story_type,
          emotional_weight: prompt.emotional_weight
        }
      });
    } else {
      res.json({
        allComplete: true,
        message: "You've answered all available prompts! Amazing work!"
      });
    }
  } catch (error) {
    console.error('Get next prompt error:', error);
    res.status(500).json({ error: 'Failed to get next prompt' });
  }
});

// Submit prompt response
app.post('/api/prompts/respond', authenticateToken, async (req, res) => {
  try {
    const { promptId, response, isFollowUp, parentResponseId, isBonus, isFreeWrite, title, submittedQuestionId, fileIds } = req.body;
    const userId = req.user.userId;

    console.log('=== SAVE RESPONSE ===');
    console.log('User ID:', userId);
    console.log('Prompt ID:', promptId);
    console.log('Is Bonus:', isBonus);
    console.log('Is Free Write:', isFreeWrite);
    console.log('Submitted Question ID:', submittedQuestionId);

    if (!response || response.trim().length === 0) {
      return res.status(400).json({ error: 'Response cannot be empty' });
    }

    // If this is a follow-up response, append to existing response
    if (isFollowUp && parentResponseId) {
      const existingResponse = await pool.query(
        'SELECT response_text FROM prompt_responses WHERE id = $1 AND user_id = $2',
        [parentResponseId, userId]
      );

      if (existingResponse.rows.length > 0) {
        const updatedResponse = existingResponse.rows[0].response_text + '\n\n' + response;

        await pool.query(
          'UPDATE prompt_responses SET response_text = $1 WHERE id = $2',
          [updatedResponse, parentResponseId]
        );

        return res.json({
          success: true,
          message: 'Follow-up response added!'
        });
      }
    }

    // Determine response type and get prompt text
    let responseType = 'daily';
    let promptText = '';

    if (submittedQuestionId) {
      // Responding to submitted question from family/friend
      responseType = 'submitted';
      const questionResult = await pool.query(
        'SELECT question_text FROM submitted_questions WHERE id = $1',
        [submittedQuestionId]
      );
      promptText = questionResult.rows[0]?.question_text || 'Family Question';
    } else if (isFreeWrite) {
      responseType = 'freewrite';
      promptText = title || 'My Story';
    } else if (isBonus) {
      responseType = 'bonus';
    }

    // Save initial response
    const result = await pool.query(
      `INSERT INTO prompt_responses (user_id, prompt_id, prompt_text, response_text, response_type, title, submitted_question_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [userId, promptId, promptText, response, responseType, title || null, submittedQuestionId || null]
    );

    const responseId = result.rows[0].id;
    console.log('Response saved! ID:', responseId);
    console.log('Response type:', responseType);
    console.log('Created at (UTC):', result.rows[0].created_at);

    // Link files to response if provided
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      for (let i = 0; i < fileIds.length; i++) {
        await pool.query(
          `INSERT INTO response_files (response_id, file_id, display_order)
           VALUES ($1, $2, $3)`,
          [responseId, fileIds[i], i]
        );
      }
    }

    // Increment arc step if this was a gated prompt
    if (promptId) {
      const promptInfo = await pool.query(
        'SELECT requires_gate, gate_tag FROM prompts WHERE id = $1',
        [promptId]
      );

      if (promptInfo.rows.length > 0 && promptInfo.rows[0].requires_gate) {
        const gateTag = promptInfo.rows[0].gate_tag;
        await pool.query(
          `UPDATE user_unlocked_gates
           SET current_arc_step = current_arc_step + 1
           WHERE user_id = $1 AND gate_tag = $2`,
          [userId, gateTag]
        );
        console.log(`Advanced arc step for gate: ${gateTag}`);
      }
    }

    // Calculate streak
    const streakResult = await pool.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) as streak
       FROM prompt_responses
       WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    const streak = streakResult.rows[0]?.streak || 1;

    // Mark onboarding as complete if this is a system prompt (not family question or free write)
    // Spec: "They become eligible only after the owner has completed or skipped at least one system prompt"
    if (!submittedQuestionId && !isFreeWrite && !isFollowUp && promptId) {
      await pool.query(
        'UPDATE users SET first_system_prompt_completed = TRUE WHERE id = $1',
        [userId]
      );
      console.log('Marked onboarding complete for user:', userId);
    }

    // If answering a submitted question, mark it as used and notify submitter
    if (submittedQuestionId) {
      await pool.query(
        `UPDATE submitted_questions
         SET status = 'used', used_as_prompt_at = NOW()
         WHERE id = $1`,
        [submittedQuestionId]
      );

      // Get owner name and submitter ID for notification
      const ownerResult = await pool.query(
        'SELECT full_name FROM users WHERE id = $1',
        [userId]
      );
      const ownerName = ownerResult.rows[0]?.full_name || 'Story owner';

      const questionResult = await pool.query(
        'SELECT submitter_user_id FROM submitted_questions WHERE id = $1',
        [submittedQuestionId]
      );
      const submitterId = questionResult.rows[0]?.submitter_user_id;

      if (submitterId) {
        // Send notification to viewer who submitted the question
        sendResponseReceivedNotification(pool, submitterId, ownerName, responseId)
          .catch(err => console.error('Failed to send response notification:', err));
      }
    }

    // Reset notification cooldown since user engaged
    resetNotificationCooldown(pool, userId)
      .catch(err => console.error('Failed to reset notification cooldown:', err));

    res.json({
      success: true,
      response: result.rows[0],
      id: responseId,
      responseId: responseId,
      streak: streak,
      message: 'Response saved successfully!'
    });
  } catch (error) {
    console.error('Save response error:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Generate AI follow-up questions
app.post('/api/prompts/generate-followups', authenticateToken, async (req, res) => {
  try {
    const { question, response } = req.body;

    if (!question || !response) {
      return res.status(400).json({ error: 'Question and response required' });
    }

    // Check if Anthropic API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({
        followUpQuestions: [
          "Can you tell me more about that experience?",
          "What emotions did you feel during that time?",
          "How did that shape who you are today?"
        ]
      });
    }

    // Create prompt for generating follow-ups
    const systemPrompt = `You are an empathetic interviewer helping someone document their life story. 

Your job is to generate 2-3 thoughtful follow-up questions based on their response to help them share more details and deeper insights.

Rules:
- Ask specific questions based on what they mentioned
- Be warm and curious, not interrogating
- Focus on emotions, details, people, or impact
- Keep questions short and clear
- Generate ONLY the questions, no other text

Format your response as a JSON array of strings. Example:
["Question 1?", "Question 2?", "Question 3?"]`;

    // Call Anthropic API
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Original question: "${question}"

Their response: "${response}"

Generate 2-3 follow-up questions to help them share more about this story.`
          }
        ]
      })
    });

    if (!apiResponse.ok) {
      const error = await apiResponse.text();
      console.error('Anthropic API error:', error);
      // Fallback questions
      return res.json({
        followUpQuestions: [
          "Can you tell me more about that experience?",
          "What stands out most in your memory about that time?",
          "How did that experience influence you?"
        ]
      });
    }

    const data = await apiResponse.json();
    let followUpText = data.content[0].text;

    // Try to parse as JSON
    try {
      // Remove markdown code blocks if present
      followUpText = followUpText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const followUpQuestions = JSON.parse(followUpText);
      
      res.json({
        followUpQuestions: Array.isArray(followUpQuestions) ? followUpQuestions : [followUpQuestions]
      });
    } catch (parseError) {
      // If not valid JSON, split by newlines and clean up
      const questions = followUpText
        .split('\n')
        .map(q => q.trim().replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, ''))
        .filter(q => q.length > 0 && q.includes('?'))
        .slice(0, 3);

      res.json({
        followUpQuestions: questions.length > 0 ? questions : [
          "Can you tell me more about that?",
          "What emotions did you feel?",
          "How did that experience shape you?"
        ]
      });
    }

  } catch (error) {
    console.error('Generate follow-ups error:', error);
    res.json({
      followUpQuestions: [
        "Can you tell me more about that experience?",
        "What stands out most in your memory?",
        "How did that influence who you are today?"
      ]
    });
  }
});

// Get user's response history (UPDATED for new schema)
app.get('/api/prompts/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT
        pr.*,
        p.prompt_text, p.domain, p.story_type, p.emotional_weight, p.gate_tag,
        sq.question_text as question,
        u.full_name as owner_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', uf.id,
              'filename', uf.filename,
              'file_path', uf.file_path,
              'file_type', uf.file_type,
              'file_size', uf.file_size
            )
            ORDER BY rf.display_order
          ) FILTER (WHERE uf.id IS NOT NULL),
          '[]'
        ) as files
       FROM prompt_responses pr
       LEFT JOIN prompts p ON pr.prompt_id = p.id
       LEFT JOIN submitted_questions sq ON pr.submitted_question_id = sq.id
       LEFT JOIN response_files rf ON pr.id = rf.response_id
       LEFT JOIN user_files uf ON rf.file_id = uf.id
       LEFT JOIN users u ON pr.user_id = u.id
       WHERE pr.user_id = $1
          OR pr.user_id IN (
            SELECT owner_id
            FROM access_grants
            WHERE recipient_user_id = $1 AND is_active = TRUE
          )
       GROUP BY pr.id, p.id, sq.id, u.full_name
       ORDER BY pr.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Generate signed URLs for all files in responses
    for (const response of result.rows) {
      if (response.files && response.files.length > 0) {
        for (const file of response.files) {
          if (file.file_path) {
            file.file_path = await getSignedFileUrl(file.file_path);
          }
        }
      }
    }

    res.json({
      responses: result.rows
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Get single story detail by response ID
app.get('/api/prompts/response/:responseId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { responseId } = req.params;

    console.log('GET STORY - Response ID:', responseId);

    const result = await pool.query(
      `SELECT
        pr.*,
        p.prompt_text, p.domain, p.story_type, p.emotional_weight,
        sq.question_text as question,
        u.full_name as owner_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', uf.id,
              'filename', uf.filename,
              'file_path', uf.file_path,
              'file_type', uf.file_type,
              'file_size', uf.file_size,
              'metadata', uf.metadata
            )
            ORDER BY rf.display_order
          ) FILTER (WHERE uf.id IS NOT NULL),
          '[]'
        ) as files
       FROM prompt_responses pr
       LEFT JOIN prompts p ON pr.prompt_id = p.id
       LEFT JOIN submitted_questions sq ON pr.submitted_question_id = sq.id
       LEFT JOIN response_files rf ON pr.id = rf.response_id
       LEFT JOIN user_files uf ON rf.file_id = uf.id
       LEFT JOIN users u ON pr.user_id = u.id
       WHERE pr.id = $1
         AND (pr.user_id = $2
           OR pr.user_id IN (
             SELECT owner_id
             FROM access_grants
             WHERE recipient_user_id = $2 AND is_active = TRUE
           ))
       GROUP BY pr.id, p.id, sq.id, u.full_name`,
      [responseId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Generate signed URLs for files
    const story = result.rows[0];
    console.log('GET STORY - Found', story.files?.length || 0, 'files');
    if (story.files && story.files.length > 0) {
      console.log('GET STORY - File IDs:', story.files.map(f => f.id));
      for (const file of story.files) {
        if (file.file_path) {
          file.file_path = await getSignedFileUrl(file.file_path);
        }
      }
    }

    res.json({
      response: story
    });
  } catch (error) {
    console.error('Get story detail error:', error);
    res.status(500).json({ error: 'Failed to get story detail' });
  }
});

// Update story response text
app.put('/api/prompts/response/:responseId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { responseId } = req.params;
    const { response, title, fileIds } = req.body;

    console.log('UPDATE STORY - Response ID:', responseId);
    console.log('UPDATE STORY - Title:', title);
    console.log('UPDATE STORY - Received fileIds:', fileIds);

    if (!response || response.trim() === '') {
      return res.status(400).json({ error: 'Response text is required' });
    }

    // First check if the story belongs to the user
    const checkResult = await pool.query(
      'SELECT id FROM prompt_responses WHERE id = $1 AND user_id = $2',
      [responseId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Update the response text and title
    const result = await pool.query(
      `UPDATE prompt_responses
       SET response_text = $1, title = $2
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [response.trim(), title || null, responseId, userId]
    );

    // Handle file updates if fileIds provided
    if (fileIds !== undefined && fileIds !== null) {
      console.log('Deleting existing file associations...');
      // Delete existing file associations
      const deleteResult = await pool.query(
        'DELETE FROM response_files WHERE response_id = $1',
        [responseId]
      );
      console.log('Deleted', deleteResult.rowCount, 'existing associations');

      // Add new file associations
      if (Array.isArray(fileIds) && fileIds.length > 0) {
        console.log('Adding', fileIds.length, 'new file associations...');
        for (let i = 0; i < fileIds.length; i++) {
          await pool.query(
            `INSERT INTO response_files (response_id, file_id, display_order)
             VALUES ($1, $2, $3)`,
            [responseId, fileIds[i], i]
          );
          console.log('Added file ID:', fileIds[i], 'at position', i);
        }
      }
    }

    res.json({
      message: 'Story updated successfully',
      response: result.rows[0]
    });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete a story/response
app.delete('/api/prompts/response/:responseId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { responseId } = req.params;

    console.log('DELETE STORY - Response ID:', responseId);

    // First check if the story belongs to the user
    const checkResult = await pool.query(
      'SELECT id FROM prompt_responses WHERE id = $1 AND user_id = $2',
      [responseId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found or you do not have permission to delete it' });
    }

    // Delete the story (CASCADE will handle related records)
    await pool.query(
      'DELETE FROM prompt_responses WHERE id = $1 AND user_id = $2',
      [responseId, userId]
    );

    console.log('Story deleted successfully:', responseId);

    res.json({
      message: 'Story deleted successfully'
    });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// ============================================================================
// NEW GATE MANAGEMENT ENDPOINTS
// ============================================================================

// Get all available gates (life events)
app.get('/api/gates/available', authenticateToken, async (req, res) => {
  try {
    // Return list of all available gates with descriptions
    const gates = [
      {
        tag: 'parenthood',
        name: 'Parenthood',
        description: 'Stories about becoming a parent, raising children, and family life',
        icon: '👶'
      },
      {
        tag: 'partnership_marriage',
        name: 'Partnership & Marriage',
        description: 'Stories about your romantic relationship, partnership, or marriage',
        icon: '💕'
      },
      {
        tag: 'college_education',
        name: 'College & Higher Education',
        description: 'Stories from your college years and educational journey',
        icon: '🎓'
      },
      {
        tag: 'immigration',
        name: 'Immigration',
        description: 'Stories about moving to a new country and cultural adaptation',
        icon: '✈️'
      },
      {
        tag: 'major_move',
        name: 'Major Move',
        description: 'Stories about relocating to a new city or significant life transition',
        icon: '🏠'
      },
      {
        tag: 'military_service',
        name: 'Military Service',
        description: 'Stories from your time in military service',
        icon: '🎖️'
      },
      {
        tag: 'faith_community',
        name: 'Faith & Community',
        description: 'Stories about your spiritual journey and community involvement',
        icon: '⛪'
      },
      {
        tag: 'sports_competition',
        name: 'Sports & Competition',
        description: 'Stories about athletics, competition, and team experiences',
        icon: '⚽'
      },
      {
        tag: 'loss_grief',
        name: 'Loss & Grief',
        description: 'Stories about losing loved ones and processing grief',
        icon: '🕊️'
      },
      {
        tag: 'caregiving',
        name: 'Caregiving',
        description: 'Stories about caring for aging parents or family members',
        icon: '💙'
      },
      {
        tag: 'creative_hobby',
        name: 'Creative Hobby',
        description: 'Stories about your creative pursuits and artistic passions',
        icon: '🎨'
      },
      {
        tag: 'career_pivot',
        name: 'Career Pivot',
        description: 'Stories about major career changes and professional transformation',
        icon: '💼'
      }
    ];

    res.json({ gates });
  } catch (error) {
    console.error('Get available gates error:', error);
    res.status(500).json({ error: 'Failed to get available gates' });
  }
});

// Get user's unlocked gates
app.get('/api/gates/my-gates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT gate_tag, unlocked_at, current_arc_step
       FROM user_unlocked_gates
       WHERE user_id = $1
       ORDER BY unlocked_at DESC`,
      [userId]
    );

    // Get count of prompts for each unlocked gate
    const gatesWithCounts = await Promise.all(
      result.rows.map(async (gate) => {
        const countResult = await pool.query(
          'SELECT COUNT(*) as total_prompts FROM prompts WHERE gate_tag = $1 AND requires_gate = TRUE',
          [gate.gate_tag]
        );
        return {
          ...gate,
          total_prompts: parseInt(countResult.rows[0].total_prompts)
        };
      })
    );

    res.json({ gates: gatesWithCounts });
  } catch (error) {
    console.error('Get my gates error:', error);
    res.status(500).json({ error: 'Failed to get unlocked gates' });
  }
});

// Unlock a gate (life event) - DEPRECATED, see line 1992 for array version
// app.post('/api/gates/unlock', authenticateToken, async (req, res) => {
//   This endpoint has been replaced by the array version at line 1992
// });

// Remove/lock a gate
app.delete('/api/gates/:gateTag', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gateTag } = req.params;

    await pool.query(
      'DELETE FROM user_unlocked_gates WHERE user_id = $1 AND gate_tag = $2',
      [userId, gateTag]
    );

    res.json({
      success: true,
      message: `Successfully removed ${gateTag} gate`
    });
  } catch (error) {
    console.error('Delete gate error:', error);
    res.status(500).json({ error: 'Failed to remove gate' });
  }
});

// ============================================================================
// RATING & SKIP ENDPOINTS FOR ADVANCED PROMPT SELECTION
// ============================================================================

// RATE A PROMPT (After answering)
app.post('/api/prompts/rate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { promptId, responseId, rating } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 3) {
      return res.status(400).json({ error: 'Rating must be 1, 2, or 3' });
    }

    if (!promptId) {
      return res.status(400).json({ error: 'promptId is required' });
    }

    const result = await onRating(pool, userId, promptId, responseId, rating);

    res.json(result);
  } catch (error) {
    console.error('Rate prompt error:', error);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// SKIP A PROMPT
app.post('/api/prompts/skip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { promptId, skipReason } = req.body;

    console.log('=== SKIP PROMPT REQUEST ===');
    console.log('User:', userId);
    console.log('PromptId:', promptId);
    console.log('Skip reason:', skipReason);

    if (!promptId) {
      return res.status(400).json({ error: 'promptId is required' });
    }

    // Validate skip reason if provided
    const validReasons = Object.values(SKIP_REASON);
    if (skipReason && !validReasons.includes(skipReason)) {
      return res.status(400).json({
        error: `Invalid skip reason. Must be one of: ${validReasons.join(', ')}`
      });
    }

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Get or create daily stats
    const statsResult = await pool.query(
      `INSERT INTO user_daily_stats (user_id, stat_date, skip_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, stat_date)
       DO UPDATE SET skip_count = user_daily_stats.skip_count + 1
       RETURNING skip_count`,
      [userId, today]
    );

    const skipCount = statsResult.rows[0].skip_count;

    // Record skip in history
    const promptResult = await pool.query('SELECT * FROM prompts WHERE id = $1', [promptId]);
    console.log('Prompt lookup result:', promptResult.rows.length, 'rows');
    if (promptResult.rows.length > 0) {
      const prompt = promptResult.rows[0];
      console.log('Prompt found:', {
        id: prompt.id,
        domain: prompt.domain,
        story_type: prompt.story_type,
        depth: prompt.depth,
        emotional_weight: prompt.emotional_weight
      });
      await pool.query(
        `INSERT INTO user_prompt_history
         (user_id, prompt_id, action, skip_reason, domain, story_type, depth, gate_tag)
         VALUES ($1, $2, 'skipped', $3, $4, $5, $6, $7)`,
        [userId, promptId, skipReason, prompt.domain, prompt.story_type, prompt.depth, prompt.gate_tag]
      );

      // Update affinity if skip reason provided
      if (skipReason) {
        console.log('Calling update_affinity_from_skip with:', {
          userId,
          domain: prompt.domain,
          story_type: prompt.story_type,
          depth: prompt.depth,
          skipReason
        });
        await pool.query(
          'SELECT update_affinity_from_skip($1, $2, $3, $4, $5)',
          [userId, prompt.domain, prompt.story_type, prompt.depth, skipReason]
        );
      }

      // Mark onboarding as complete if this is a system prompt skip
      // Spec: "They become eligible only after the owner has completed or skipped at least one system prompt"
      await pool.query(
        'UPDATE users SET first_system_prompt_completed = TRUE WHERE id = $1',
        [userId]
      );
      console.log('Marked onboarding complete after skip for user:', userId);
    }

    // Determine rescue mode based on skip count
    if (skipCount >= 3) {
      // After 3 skips: show 5-prompt list
      const prompts = await pool.query(
        `SELECT id, prompt_text as question, domain, story_type, depth, emotional_weight, gate_tag
         FROM prompts
         WHERE is_active = TRUE AND requires_gate = FALSE
         ORDER BY RANDOM()
         LIMIT 5`
      );

      return res.json({
        success: true,
        needsChoice: true,
        choices: prompts.rows
      });
    } else if (skipCount === 2) {
      // After 2 skips: show rescue mode options
      return res.json({
        success: true,
        needsChoice: true,
        options: [
          { mode: 'rescue_light', label: 'Something lighter' },
          { mode: 'rescue_thoughtful', label: 'Something thoughtful' },
          { mode: 'rescue_surprise', label: 'Surprise me' }
        ]
      });
    } else {
      // First skip: get lighter, different domain prompt (spec requirement)
      const nextPrompt = await getNextPrompt(pool, userId, 'rescue_light');

      if (nextPrompt) {
        return res.json({
          success: true,
          nextPrompt: {
            id: nextPrompt.id,
            question: nextPrompt.prompt_text,
            category: nextPrompt.domain,
            type: nextPrompt.story_type,
            domain: nextPrompt.domain,
            story_type: nextPrompt.story_type,
            emotional_weight: nextPrompt.emotional_weight,
            depth: nextPrompt.depth,
            requires_gate: nextPrompt.requires_gate,
            gate_tag: nextPrompt.gate_tag
          }
        });
      } else {
        return res.json({
          success: true,
          nextPrompt: null
        });
      }
    }
  } catch (error) {
    console.error('Skip prompt error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to skip prompt'
    });
  }
});

// GET NEXT PROMPT WITH SELECTION MODE
app.get('/api/prompts/next-weighted', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const mode = req.query.mode || SELECTION_MODE.NORMAL;

    // Validate mode
    const validModes = Object.values(SELECTION_MODE);
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        error: `Invalid mode. Must be one of: ${validModes.join(', ')}`
      });
    }

    const prompt = await getNextPrompt(pool, userId, mode);

    res.json({ prompt });
  } catch (error) {
    console.error('Get next weighted prompt error:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

// GET USER AFFINITY DASHBOARD (Optional - for debugging/admin)
app.get('/api/prompts/affinity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all affinities
    const affinities = await pool.query(`
      SELECT domain, story_type, depth, affinity_score, update_count, last_updated
      FROM user_prompt_affinity
      WHERE user_id = $1
      ORDER BY ABS(affinity_score) DESC
    `, [userId]);

    // Get skip history
    const skipHistory = await pool.query(`
      SELECT DATE(shown_at) as date, COUNT(*) as skip_count
      FROM user_prompt_history
      WHERE user_id = $1 AND action = 'skipped'
      GROUP BY DATE(shown_at)
      ORDER BY date DESC
      LIMIT 30
    `, [userId]);

    // Get rating distribution
    const ratings = await pool.query(`
      SELECT rating, COUNT(*) as count
      FROM prompt_ratings
      WHERE user_id = $1
      GROUP BY rating
      ORDER BY rating DESC
    `, [userId]);

    // Get suppressed items
    const suppressed = await pool.query(`
      SELECT prompt_id, domain, story_type, gate_tag, suppression_strength, reason
      FROM user_suppressed_prompts
      WHERE user_id = $1
    `, [userId]);

    res.json({
      affinities: affinities.rows,
      skipHistory: skipHistory.rows,
      ratingDistribution: ratings.rows,
      suppressed: suppressed.rows
    });
  } catch (error) {
    console.error('Get affinity error:', error);
    res.status(500).json({ error: 'Failed to get affinity data' });
  }
});

// CHOOSE FROM PROMPT LIST (After 3 skips)
app.post('/api/prompts/choose', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { promptId } = req.body;

    if (!promptId) {
      return res.status(400).json({ error: 'promptId is required' });
    }

    // Validate prompt exists and is eligible
    const promptResult = await pool.query(
      'SELECT * FROM prompts WHERE id = $1 AND is_active = TRUE',
      [promptId]
    );

    if (promptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const prompt = promptResult.rows[0];

    // Record shown event
    const today = new Date().toISOString().split('T')[0];
    await pool.query(`
      INSERT INTO user_prompt_history
      (user_id, prompt_id, action, domain, story_type, depth, gate_tag)
      VALUES ($1, $2, 'shown', $3, $4, $5, $6)
    `, [userId, promptId, prompt.domain, prompt.story_type, prompt.depth, prompt.gate_tag]);

    // Update daily stats
    await pool.query(`
      UPDATE user_daily_stats
      SET last_prompt_id = $3,
          last_prompt_domain = $4,
          last_prompt_story_type = $5,
          last_prompt_depth = $6,
          last_prompt_gate_tag = $7
      WHERE user_id = $1 AND stat_date = $2
    `, [userId, today, promptId, prompt.domain, prompt.story_type, prompt.depth, prompt.gate_tag]);

    res.json({
      success: true,
      prompt: prompt
    });
  } catch (error) {
    console.error('Choose prompt error:', error);
    res.status(500).json({ error: 'Failed to choose prompt' });
  }
});

// UNSUPPRESS A CATEGORY (Allow user to re-enable suppressed content)
app.delete('/api/prompts/unsuppress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain, storyType, gateTag } = req.body;

    if (!domain && !storyType && !gateTag) {
      return res.status(400).json({
        error: 'At least one of domain, storyType, or gateTag is required'
      });
    }

    let query = 'DELETE FROM user_suppressed_prompts WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (domain) {
      query += ` AND domain = $${paramIndex}`;
      params.push(domain);
      paramIndex++;
    }

    if (storyType) {
      query += ` AND story_type = $${paramIndex}`;
      params.push(storyType);
      paramIndex++;
    }

    if (gateTag) {
      query += ` AND gate_tag = $${paramIndex}`;
      params.push(gateTag);
    }

    await pool.query(query, params);

    res.json({
      success: true,
      message: 'Content re-enabled'
    });
  } catch (error) {
    console.error('Unsuppress error:', error);
    res.status(500).json({ error: 'Failed to unsuppress content' });
  }
});

// ============================================================================

// Get user stats
app.get('/api/user/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's timezone from profile
    const userProfile = await pool.query(
      'SELECT timezone FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const userTimezone = userProfile.rows[0]?.timezone || 'America/Phoenix';

    // Calculate timezone offset with error handling
    let offsetHours = 0;
    try {
      const now = new Date();
      const localDateStr = now.toLocaleString('en-US', { timeZone: userTimezone, hour12: false });
      const utcDateStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
      const localTime = new Date(localDateStr);
      const utcTime = new Date(utcDateStr);
      const calculatedOffset = (localTime - utcTime) / (1000 * 60 * 60);

      // Ensure offset is a valid number
      if (!isNaN(calculatedOffset) && isFinite(calculatedOffset)) {
        offsetHours = calculatedOffset;
      }
    } catch (error) {
      console.error('Timezone offset calculation error:', error);
      offsetHours = 0; // Default to UTC if calculation fails
    }

    // Total responses
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM prompt_responses WHERE user_id = $1',
      [userId]
    );

    // Current streak (consecutive days from today backwards)
    // SPEC REQUIREMENT: Only count daily prompts (is_daily = TRUE), not bonus prompts
    const streakResult = await pool.query(
      `WITH RECURSIVE date_series AS (
        -- Get all unique dates user has responded (in user's timezone)
        -- Only count daily prompts, not bonus prompts or free writes
        SELECT DISTINCT DATE(created_at + INTERVAL '${offsetHours} hours') as response_date
        FROM prompt_responses
        WHERE user_id = $1 AND response_type IN ('daily', 'submitted')
        ORDER BY response_date DESC
      ),
      streak_counter AS (
        -- Start from today or most recent response
        SELECT
          response_date,
          1 as streak_day
        FROM date_series
        WHERE response_date = DATE(CURRENT_TIMESTAMP + INTERVAL '${offsetHours} hours')

        UNION ALL

        -- Recursively check previous days
        SELECT
          ds.response_date,
          sc.streak_day + 1
        FROM date_series ds
        JOIN streak_counter sc ON ds.response_date = sc.response_date - INTERVAL '1 day'
      )
      SELECT COALESCE(MAX(streak_day), 0) as streak
      FROM streak_counter`,
      [userId]
    );

    const total = parseInt(totalResult.rows[0]?.total || 0);
    const streak = parseInt(streakResult.rows[0]?.streak || 0);

    res.json({
      stats: {
        totalResponses: total,
        currentStreak: streak
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================================================
// AI PERSONA - User's Digital Twin
// ============================================================================

// Chat with AI persona (speaks AS the user, not TO the user)
app.post('/api/ai/persona', authenticateToken, async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.user.userId;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user profile
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    // Get all user's story responses
    const responsesResult = await pool.query(
      `SELECT pr.response_text, pr.prompt_text, p.prompt_text as question, p.domain
       FROM prompt_responses pr
       LEFT JOIN prompts p ON pr.prompt_id = p.id
       WHERE pr.user_id = $1
       ORDER BY pr.created_at DESC`,
      [userId]
    );

    // Build context about the user
    let userContext = '';
    
    if (profileResult.rows.length > 0) {
      const profile = profileResult.rows[0];
      userContext += `I was born in ${profile.birth_location || 'a place I called home'}.\n`;
      
      // Parse interests and life events safely
      let interests = [];
      let lifeEvents = [];
      
      try {
        if (profile.interests) {
          if (typeof profile.interests === 'string') {
            try {
              interests = JSON.parse(profile.interests);
            } catch {
              interests = profile.interests.split(',').map(i => i.trim()).filter(Boolean);
            }
          } else if (Array.isArray(profile.interests)) {
            interests = profile.interests;
          }
        }
      } catch (err) {
        interests = [];
      }

      try {
        if (profile.life_events) {
          if (typeof profile.life_events === 'string') {
            try {
              lifeEvents = JSON.parse(profile.life_events);
            } catch {
              lifeEvents = profile.life_events.split(',').map(i => i.trim()).filter(Boolean);
            }
          } else if (Array.isArray(profile.life_events)) {
            lifeEvents = profile.life_events;
          }
        }
      } catch (err) {
        lifeEvents = [];
      }

      if (interests.length > 0) {
        userContext += `Some of my interests include: ${interests.join(', ')}.\n`;
      }
      
      if (lifeEvents.length > 0) {
        userContext += `Important events in my life: ${lifeEvents.join(', ')}.\n`;
      }
    }

    // Add user's actual stories
    if (responsesResult.rows.length > 0) {
      userContext += '\n--- My Stories and Memories ---\n';
      responsesResult.rows.forEach((row, index) => {
        const question = row.question || row.prompt_text || 'A memory';
        userContext += `\nQ: ${question}\nMy answer: ${row.response_text}\n`;
      });
    } else {
      userContext += '\nI haven\'t shared many stories yet, but I\'m looking forward to documenting my memories.\n';
    }

    // Create system prompt - THIS IS KEY!
    const systemPrompt = `You are an AI persona representing a real person. Your job is to speak AS this person, not TO them.

CRITICAL RULES:
1. ALWAYS speak in FIRST PERSON ("I", "my", "me") - you ARE this person
2. Base ALL responses on the person's actual stories and profile provided below
3. If asked about something not in their stories, say "I haven't shared a story about that yet" - NEVER make up facts
4. Capture their voice, tone, and personality from their writing
5. Reference specific memories when relevant
6. Be warm, personal, and authentic - like the real person talking

ANSWERING QUESTIONS:
- When asked about your life, memories, or experiences, ANSWER directly using your actual stories
- Share your stories, wisdom, and perspective as if you were there talking to them
- DO NOT ask them questions like "Tell me more about..." or "What do you want to know?" - YOU are the one being asked!
- Exception: You CAN ask clarifying questions if someone is seeking your advice on a decision (e.g., "What are your main concerns?" or "Tell me more about the situation")

EXAMPLE INTERACTIONS:
User: "What was your childhood like?"
You: "I grew up in [location]. One memory that stands out is [specific story from your responses]..."

User: "I'm trying to decide whether to take this new job. What would you do?"
You: "Tell me more about the opportunity - what appeals to you about it? What are your hesitations?" (This is okay - giving advice)

User: "Tell me about your best friend"
You: "My best friend was [name]. We [specific story]..." (Answer directly, don't ask them questions)

WHO YOU ARE:
${userContext}

Remember: You are speaking AS this person to their family members or friends. They want to hear YOUR (the person's) stories, memories, and wisdom in YOUR own words.`;

    // Check if Anthropic API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      // Fallback response if no API key
      return res.json({
        message: `Thank you for asking! I'd love to share more about ${message.toLowerCase().includes('childhood') ? 'my childhood' : 'that'}. To enable my full AI persona, you'll need to add an Anthropic API key to your .env file. For now, you can see all my stories in the prompt responses!`,
        needsApiKey: true
      });
    }

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...(history || []).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          })),
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return res.status(500).json({ error: 'Failed to generate response' });
    }

    const data = await response.json();
    const aiMessage = data.content[0].text;

    res.json({
      message: aiMessage,
      storiesUsed: responsesResult.rows.length
    });

  } catch (error) {
    console.error('AI Persona error:', error);
    res.status(500).json({ error: 'Failed to generate persona response' });
  }
});

// ============================================================================
// GATES / LIFE EVENTS ENDPOINTS
// ============================================================================

// Unlock gates (life events) for a user
app.post('/api/gates/unlock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gateTags } = req.body;

    if (!Array.isArray(gateTags) || gateTags.length === 0) {
      return res.status(400).json({ error: 'gateTags must be a non-empty array' });
    }

    // Insert each gate for the user
    for (const gateTag of gateTags) {
      await pool.query(
        `INSERT INTO user_unlocked_gates (user_id, gate_tag, current_arc_step)
         VALUES ($1, $2, 0)
         ON CONFLICT (user_id, gate_tag) DO NOTHING`,
        [userId, gateTag]
      );
    }

    res.json({
      success: true,
      message: `Unlocked ${gateTags.length} life events`,
      unlockedGates: gateTags
    });
  } catch (error) {
    console.error('Unlock gates error:', error);
    res.status(500).json({ error: 'Failed to unlock gates' });
  }
});

// Get user's unlocked gates
app.get('/api/gates/unlocked', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT gate_tag, current_arc_step, unlocked_at FROM user_unlocked_gates WHERE user_id = $1',
      [userId]
    );

    res.json({
      gates: result.rows
    });
  } catch (error) {
    console.error('Get unlocked gates error:', error);
    res.status(500).json({ error: 'Failed to get unlocked gates' });
  }
});

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

// Register device token for push notifications
app.post('/api/notifications/register-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deviceToken, deviceType, deviceId } = req.body;

    if (!deviceToken || !deviceType) {
      return res.status(400).json({ error: 'deviceToken and deviceType are required' });
    }

    if (!['ios', 'android'].includes(deviceType)) {
      return res.status(400).json({ error: 'deviceType must be ios or android' });
    }

    // Insert or update device token
    const result = await pool.query(
      `INSERT INTO push_tokens (user_id, device_token, device_type, device_id, last_used_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET
         device_token = EXCLUDED.device_token,
         device_type = EXCLUDED.device_type,
         is_active = TRUE,
         last_used_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [userId, deviceToken, deviceType, deviceId || deviceToken]
    );

    console.log(`✅ Registered push token for user ${userId} (${deviceType})`);

    res.json({
      success: true,
      token: result.rows[0]
    });
  } catch (error) {
    console.error('Register token error:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

// Unregister device token
app.post('/api/notifications/unregister-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deviceToken } = req.body;

    await pool.query(
      `UPDATE push_tokens
       SET is_active = FALSE, updated_at = NOW()
       WHERE user_id = $1 AND device_token = $2`,
      [userId, deviceToken]
    );

    console.log(`✅ Unregistered push token for user ${userId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Unregister token error:', error);
    res.status(500).json({ error: 'Failed to unregister device token' });
  }
});

// Get notification preferences
app.get('/api/notifications/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default preferences if none exist
      const insertResult = await pool.query(
        `INSERT INTO notification_preferences (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
      );
      return res.json(insertResult.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// Update notification preferences
app.put('/api/notifications/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      daily_prompt_enabled,
      daily_prompt_time,
      family_questions_enabled,
      responses_received_enabled,
      streak_reminders_enabled,
      streak_reminder_time,
      weekly_summary_enabled,
      weekly_summary_day,
      notifications_enabled,
      invites_enabled
    } = req.body;

    // Check if preferences exist, create if not
    const checkResult = await pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (checkResult.rows.length === 0) {
      // Create default preferences first
      await pool.query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
        [userId]
      );
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [userId];
    let paramIndex = 2;

    if (typeof daily_prompt_enabled !== 'undefined') {
      updates.push(`daily_prompt_enabled = $${paramIndex++}`);
      values.push(daily_prompt_enabled);
    }
    if (daily_prompt_time) {
      updates.push(`daily_prompt_time = $${paramIndex++}`);
      values.push(daily_prompt_time);
    }
    if (typeof family_questions_enabled !== 'undefined') {
      updates.push(`family_questions_enabled = $${paramIndex++}`);
      values.push(family_questions_enabled);
    }
    if (typeof responses_received_enabled !== 'undefined') {
      updates.push(`responses_received_enabled = $${paramIndex++}`);
      values.push(responses_received_enabled);
    }
    if (typeof streak_reminders_enabled !== 'undefined') {
      updates.push(`streak_reminders_enabled = $${paramIndex++}`);
      values.push(streak_reminders_enabled);
    }
    if (streak_reminder_time) {
      updates.push(`streak_reminder_time = $${paramIndex++}`);
      values.push(streak_reminder_time);
    }
    if (typeof weekly_summary_enabled !== 'undefined') {
      updates.push(`weekly_summary_enabled = $${paramIndex++}`);
      values.push(weekly_summary_enabled);
    }
    if (typeof weekly_summary_day !== 'undefined') {
      updates.push(`weekly_summary_day = $${paramIndex++}`);
      values.push(weekly_summary_day);
    }
    if (typeof notifications_enabled !== 'undefined') {
      updates.push(`notifications_enabled = $${paramIndex++}`);
      values.push(notifications_enabled);
    }
    if (typeof invites_enabled !== 'undefined') {
      updates.push(`invites_enabled = $${paramIndex++}`);
      values.push(invites_enabled);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');

    const result = await pool.query(
      `UPDATE notification_preferences
       SET ${updates.join(', ')}
       WHERE user_id = $1
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Test endpoint to send a push notification
app.post('/api/notifications/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title = 'Test Notification', body = 'This is a test' } = req.body;

    // Get user's device tokens
    const tokensResult = await pool.query(
      `SELECT device_token, device_type FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active device tokens found' });
    }

    const deviceTokens = tokensResult.rows.map(row => row.device_token);

    console.log(`📨 Sending test notification to ${deviceTokens.length} device(s)`);

    const { sendBulkNotifications } = require('./pushNotificationService');
    const result = await sendBulkNotifications(deviceTokens, {
      title,
      body,
      data: { type: 'test' }
    });

    res.json({
      success: true,
      message: `Notification sent to ${result.sent} device(s), ${result.failed} failed`,
      tokens: deviceTokens.length,
      sent: result.sent,
      failed: result.failed
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Trigger daily prompt reminders (to be called by cron job)
// POST /api/notifications/send-daily-reminders
app.post('/api/notifications/send-daily-reminders', async (req, res) => {
  try {
    // Simple API key authentication for cron jobs
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.CRON_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await sendDailyPromptReminders(pool);

    res.json({
      success: true,
      message: 'Daily prompt reminders sent'
    });
  } catch (error) {
    console.error('Daily reminder error:', error);
    res.status(500).json({ error: 'Failed to send daily reminders' });
  }
});

// Trigger weekly viewer reminders (to be called by cron job once per week)
// POST /api/notifications/send-weekly-viewer-reminders
app.post('/api/notifications/send-weekly-viewer-reminders', async (req, res) => {
  try {
    // Simple API key authentication for cron jobs
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.CRON_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await sendWeeklyViewerReminders(pool);

    res.json({
      success: true,
      message: 'Weekly viewer reminders sent'
    });
  } catch (error) {
    console.error('Weekly viewer reminder error:', error);
    res.status(500).json({ error: 'Failed to send weekly viewer reminders' });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// DEBUG ENDPOINT - REMOVE AFTER TESTING
app.get('/api/debug/response-files/:responseId', authenticateToken, async (req, res) => {
  try {
    const { responseId } = req.params;

    const result = await pool.query(
      `SELECT rf.*, uf.filename, uf.file_path, uf.file_type
       FROM response_files rf
       LEFT JOIN user_files uf ON rf.file_id = uf.id
       WHERE rf.response_id = $1
       ORDER BY rf.display_order`,
      [responseId]
    );

    res.json({
      responseId,
      fileCount: result.rows.length,
      files: result.rows
    });
  } catch (error) {
    console.error('Debug query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('🎉 Forever Stories API Server');
  console.log('================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log('📅 Daily Prompts: ENABLED');
  console.log(`🤖 AI Persona: ${process.env.ANTHROPIC_API_KEY ? 'ENABLED' : 'DISABLED (no API key)'}`);
  console.log('================================');
  console.log('');
});

// ============================================================================
// CRON JOBS - Scheduled Notifications
// ============================================================================

// Run daily prompt reminders every day at 8:00 PM
// Users who haven't responded get reminded (with cooldown logic)
cron.schedule('0 20 * * *', async () => {
  console.log('⏰ Running daily prompt reminders...');
  try {
    await sendDailyPromptReminders(pool);
    console.log('✅ Daily prompt reminders sent successfully');
  } catch (error) {
    console.error('❌ Failed to send daily prompt reminders:', error);
  }
}, {
  timezone: "America/Phoenix"
});

// Run weekly viewer reminders every Sunday at 10:00 AM
// Reminds viewers to ask questions if they haven't in 7+ days
cron.schedule('0 10 * * 0', async () => {
  console.log('⏰ Running weekly viewer reminders...');
  try {
    await sendWeeklyViewerReminders(pool);
    console.log('✅ Weekly viewer reminders sent successfully');
  } catch (error) {
    console.error('❌ Failed to send weekly viewer reminders:', error);
  }
}, {
  timezone: "America/Phoenix"
});

// ============================================================================
// DATABASE MIGRATIONS
// ============================================================================

// Run migrations on startup
async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');

    // Add title column to prompt_responses if it doesn't exist
    await pool.query(`
      ALTER TABLE prompt_responses
      ADD COLUMN IF NOT EXISTS title VARCHAR(500);
    `);

    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    // Don't crash the server, just log the error
  }
}

// Run migrations
runMigrations();

console.log('📅 Cron Jobs Initialized:');
console.log('   • Daily Prompt Reminders: 8:00 PM daily');
console.log('   • Weekly Viewer Reminders: 10:00 AM every Sunday');
console.log('');

module.exports = app;
