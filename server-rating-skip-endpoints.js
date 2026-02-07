// ============================================================================
// RATING & SKIP ENDPOINTS FOR ADVANCED PROMPT SELECTION
// Add these to server.js after the existing prompt endpoints
// ============================================================================

const { getNextPrompt, onSkip, onRating, RATING, SKIP_REASON, SELECTION_MODE } = require('./promptSelectionEngine');

// ============================================================================
// RATE A PROMPT (After answering)
// ============================================================================
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

// ============================================================================
// SKIP A PROMPT
// ============================================================================
app.post('/api/prompts/skip', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { promptId, skipReason } = req.body;

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

    // Handle skip and get next prompt
    const nextPrompt = await onSkip(pool, userId, promptId, skipReason);

    res.json({
      success: true,
      nextPrompt: nextPrompt
    });
  } catch (error) {
    console.error('Skip prompt error:', error);
    res.status(500).json({ error: 'Failed to skip prompt' });
  }
});

// ============================================================================
// GET NEXT PROMPT WITH SELECTION MODE
// ============================================================================
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

// ============================================================================
// GET USER AFFINITY DASHBOARD (Optional - for debugging/admin)
// ============================================================================
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

// ============================================================================
// CHOOSE FROM PROMPT LIST (After 3 skips)
// ============================================================================
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

// ============================================================================
// UNSUPPRESS A CATEGORY (Allow user to re-enable suppressed content)
// ============================================================================
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
