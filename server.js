// server.js - Main Express server with PostgreSQL support and Daily Prompts
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Allow external connections

// Middleware
app.use(cors({
  origin: '*',
  credentials: false
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

    // Verify submitter has access grant with submitQuestions permission
    const accessCheck = await pool.query(
      `SELECT permissions FROM access_grants
       WHERE owner_id = $1
         AND (recipient_user_id = $2 OR recipient_email = $3)
         AND is_active = true`,
      [ownerId, submitterId, submitterEmail]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No access to submit questions' });
    }

    const permissions = typeof accessCheck.rows[0].permissions === 'string'
      ? JSON.parse(accessCheck.rows[0].permissions)
      : accessCheck.rows[0].permissions;

    if (!permissions.submitQuestions) {
      return res.status(403).json({ error: 'Permission to submit questions not granted' });
    }

    // Insert question
    const result = await pool.query(
      `INSERT INTO submitted_questions (story_owner_id, submitter_user_id, submitter_email, question_text, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [ownerId, submitterId, submitterEmail, questionText.trim()]
    );

    res.json({
      success: true,
      question: result.rows[0],
      message: 'Question submitted successfully'
    });
  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

// Get questions submitted to current user
app.get('/api/questions/submitted', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT sq.id, sq.question_text, sq.status, sq.created_at, sq.used_as_prompt_at,
              sq.submitter_email, u.full_name as submitter_name
       FROM submitted_questions sq
       LEFT JOIN users u ON sq.submitter_user_id = u.id
       WHERE sq.story_owner_id = $1
       ORDER BY sq.created_at DESC`,
      [ownerId]
    );

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

// ============================================================================
// DAILY PROMPTS
// ============================================================================

// Get today's prompt for user
app.get('/api/prompts/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's timezone from profile, default to America/Phoenix if not set
    const userProfile = await pool.query(
      'SELECT timezone FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const userTimezone = userProfile.rows[0]?.timezone || 'America/Phoenix';

    // Get today's date in user's local timezone using JavaScript
    const now = new Date();
    const todayInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const year = todayInUserTZ.getFullYear();
    const month = String(todayInUserTZ.getMonth() + 1).padStart(2, '0');
    const day = String(todayInUserTZ.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;

    // Calculate timezone offset in hours
    const localDateStr = now.toLocaleString('en-US', { timeZone: userTimezone, hour12: false });
    const utcDateStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const localTime = new Date(localDateStr);
    const utcTime = new Date(utcDateStr);
    const offsetHours = (localTime - utcTime) / (1000 * 60 * 60);

    // Check if user already answered TODAY'S DAILY prompt
    // Apply timezone offset to convert UTC to local time, then compare dates
    const existingResponse = await pool.query(
      `SELECT pr.*, p.question, p.category 
       FROM prompt_responses pr
       LEFT JOIN prompts p ON pr.prompt_id = p.id
       WHERE pr.user_id = $1 
       AND DATE(pr.created_at + INTERVAL '${offsetHours} hours') = $2
       AND pr.response_type = 'daily'
       LIMIT 1`,
      [userId, todayDate]
    );

    if (existingResponse.rows.length > 0) {
      return res.json({
        answered: true,
        response: existingResponse.rows[0]
      });
    }

    // Check for pending submitted questions from family/friends
    const submittedQuestion = await pool.query(
      `SELECT sq.*, u.full_name as submitter_name
       FROM submitted_questions sq
       LEFT JOIN users u ON sq.submitter_user_id = u.id
       WHERE sq.story_owner_id = $1
         AND sq.status = 'pending'
       ORDER BY sq.created_at ASC
       LIMIT 1`,
      [userId]
    );

    if (submittedQuestion.rows.length > 0) {
      const question = submittedQuestion.rows[0];

      // Mark question as used
      await pool.query(
        `UPDATE submitted_questions
         SET status = 'used', used_as_prompt_at = NOW()
         WHERE id = $1`,
        [question.id]
      );

      return res.json({
        answered: false,
        prompt: {
          id: null,
          question: question.question_text,
          category: 'family_question',
          type: 'submitted',
          submittedQuestionId: question.id,
          submitterInfo: {
            name: question.submitter_name,
            email: question.submitter_email
          }
        }
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
      
      // Handle interests - could be JSON array or comma-separated string
      try {
        if (profile.interests) {
          if (typeof profile.interests === 'string') {
            // Try to parse as JSON first
            try {
              interests = JSON.parse(profile.interests);
            } catch {
              // If that fails, treat as comma-separated string
              interests = profile.interests.split(',').map(i => i.trim()).filter(Boolean);
            }
          } else if (Array.isArray(profile.interests)) {
            interests = profile.interests;
          }
        }
      } catch (err) {
        console.error('Error parsing interests:', err);
        interests = [];
      }

      // Handle life events - could be JSON array or comma-separated string
      try {
        if (profile.life_events) {
          if (typeof profile.life_events === 'string') {
            // Try to parse as JSON first
            try {
              lifeEvents = JSON.parse(profile.life_events);
            } catch {
              // If that fails, treat as comma-separated string
              lifeEvents = profile.life_events.split(',').map(i => i.trim()).filter(Boolean);
            }
          } else if (Array.isArray(profile.life_events)) {
            lifeEvents = profile.life_events;
          }
        }
      } catch (err) {
        console.error('Error parsing life events:', err);
        lifeEvents = [];
      }

      birthLocation = profile.birth_location;
    }

    // Get prompts user hasn't answered yet
    const promptsResult = await pool.query(
      `SELECT p.* FROM prompts p
       WHERE p.id NOT IN (
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

// Get next prompt (for answering multiple prompts per day)
app.get('/api/prompts/next', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get prompts user hasn't answered yet
    const promptsResult = await pool.query(
      `SELECT p.* FROM prompts p
       WHERE p.id NOT IN (
         SELECT prompt_id FROM prompt_responses WHERE user_id = $1 AND prompt_id IS NOT NULL
       )
       ORDER BY RANDOM()
       LIMIT 1`,
      [userId]
    );

    if (promptsResult.rows.length > 0) {
      const prompt = promptsResult.rows[0];
      
      res.json({
        prompt: {
          id: prompt.id,
          question: prompt.question,
          category: prompt.category,
          type: prompt.prompt_type
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
    const { promptId, response, isFollowUp, parentResponseId, isBonus, isFreeWrite, title, submittedQuestionId } = req.body;
    const userId = req.user.userId;

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
      `INSERT INTO prompt_responses (user_id, prompt_id, prompt_text, response_text, response_type, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, promptId, promptText, response, responseType]
    );

    // Calculate streak
    const streakResult = await pool.query(
      `SELECT COUNT(DISTINCT DATE(created_at)) as streak
       FROM prompt_responses
       WHERE user_id = $1
       AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    const streak = streakResult.rows[0]?.streak || 1;

    res.json({
      success: true,
      response: result.rows[0],
      responseId: result.rows[0].id,
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
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

// Get user's response history
app.get('/api/prompts/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT pr.*, p.question, p.category, p.prompt_type
       FROM prompt_responses pr
       LEFT JOIN prompts p ON pr.prompt_id = p.id
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

    // Get user's timezone from profile
    const userProfile = await pool.query(
      'SELECT timezone FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const userTimezone = userProfile.rows[0]?.timezone || 'America/Phoenix';

    // Calculate timezone offset
    const now = new Date();
    const localDateStr = now.toLocaleString('en-US', { timeZone: userTimezone, hour12: false });
    const utcDateStr = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const localTime = new Date(localDateStr);
    const utcTime = new Date(utcDateStr);
    const offsetHours = (localTime - utcTime) / (1000 * 60 * 60);

    // Total responses
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM prompt_responses WHERE user_id = $1',
      [userId]
    );

    // Current streak (consecutive days from today backwards)
    const streakResult = await pool.query(
      `WITH RECURSIVE date_series AS (
        -- Get all unique dates user has responded (in user's timezone)
        SELECT DISTINCT DATE(created_at + INTERVAL '${offsetHours} hours') as response_date
        FROM prompt_responses
        WHERE user_id = $1
        ORDER BY response_date DESC
      ),
      streak_counter AS (
        -- Start from today or most recent response
        SELECT 
          response_date,
          1 as streak_day
        FROM date_series
        WHERE response_date = CURRENT_DATE + INTERVAL '${offsetHours} hours'
        
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
      `SELECT pr.response_text, pr.prompt_text, p.question, p.category
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
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
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

module.exports = app;
