// ============================================================================
// UPDATED PROMPT ENDPOINTS FOR ADVANCED PROMPTS SYSTEM
// Replace the corresponding endpoints in server.js after running migration
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

    // Get today's date in user's local timezone
    const now = new Date();
    const todayInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const year = todayInUserTZ.getFullYear();
    const month = String(todayInUserTZ.getMonth() + 1).padStart(2, '0');
    const day = String(todayInUserTZ.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;

    // STEP 1: Check for submitted questions first (highest priority)
    const submittedQuestion = await pool.query(
      `SELECT id, question_text as prompt_text, submitter_email, submitter_user_id
       FROM submitted_questions
       WHERE story_owner_id = $1 AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId]
    );

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
          submitterName: submitterName,
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
         AND DATE(pr.created_at AT TIME ZONE 'UTC' AT TIME ZONE $2) = $3
       ORDER BY pr.created_at DESC
       LIMIT 1`,
      [userId, userTimezone, todayDate]
    );

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

    // STEP 3: Get prompts user hasn't answered in the last 30 days
    const recentPrompts = await pool.query(
      `SELECT prompt_id
       FROM prompt_responses
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '30 days'
         AND prompt_id IS NOT NULL`,
      [userId]
    );

    const excludedPromptIds = recentPrompts.rows.map(r => r.prompt_id);

    // STEP 4: Get user's unlocked gates
    const unlockedGates = await pool.query(
      'SELECT gate_tag, current_arc_step FROM user_unlocked_gates WHERE user_id = $1',
      [userId]
    );

    const hasGates = unlockedGates.rows.length > 0;
    const gatesList = unlockedGates.rows.map(g => g.gate_tag);

    // STEP 5: Build weighted selection query
    let query = `
      SELECT *,
        CASE
          WHEN base_weight_category = 'Onboarding' THEN base_weight * 1.5
          WHEN base_weight_category = 'Arc' THEN base_weight * 1.2
          ELSE base_weight
        END as selection_weight
      FROM prompts
      WHERE is_active = TRUE
    `;

    const queryParams = [userId];
    let paramIndex = 2;

    // Exclude recently answered prompts
    if (excludedPromptIds.length > 0) {
      query += ` AND id NOT IN (${excludedPromptIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
      queryParams.push(...excludedPromptIds);
      paramIndex += excludedPromptIds.length;
    }

    // If user has gates, include gated prompts for their gates
    if (hasGates) {
      query += ` AND (requires_gate = FALSE OR gate_tag IN (${gatesList.map((_, i) => `$${paramIndex + i}`).join(',')}))`;
      queryParams.push(...gatesList);
    } else {
      // Only show core prompts if no gates unlocked
      query += ` AND requires_gate = FALSE`;
    }

    // Order by weight and randomness, limit to 1
    query += ` ORDER BY selection_weight DESC, RANDOM() LIMIT 1`;

    const promptResult = await pool.query(query, queryParams);

    if (promptResult.rows.length > 0) {
      const selectedPrompt = promptResult.rows[0];

      // Check if we should personalize the prompt with user context
      const userContext = await pool.query(
        'SELECT full_name, birth_location FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = $1',
        [userId]
      );

      let personalizedQuestion = selectedPrompt.prompt_text;

      // Simple personalization (can be enhanced with AI)
      if (userContext.rows.length > 0) {
        const { full_name } = userContext.rows[0];
        if (full_name && Math.random() > 0.7) {
          personalizedQuestion = personalizedQuestion.replace(/you/i, full_name || 'you');
        }
      }

      res.json({
        answered: false,
        prompt: {
          id: selectedPrompt.id,
          question: personalizedQuestion,
          category: selectedPrompt.domain,
          type: selectedPrompt.story_type,
          domain: selectedPrompt.domain,
          story_type: selectedPrompt.story_type,
          emotional_weight: selectedPrompt.emotional_weight,
          requires_gate: selectedPrompt.requires_gate,
          gate_tag: selectedPrompt.gate_tag
        }
      });
    } else {
      // All prompts answered - suggest unlocking more gates or show fallback
      res.json({
        answered: false,
        prompt: {
          id: null,
          question: hasGates
            ? "You've answered all available prompts! Consider unlocking more life events in your profile to access personalized story arcs."
            : "You've answered all available prompts! Unlock life events in your profile to access personalized story sequences.",
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

// Get user's response history (UPDATED for new schema)
app.get('/api/prompts/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT pr.*, p.prompt_text, p.domain, p.story_type, p.emotional_weight
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

// Unlock a gate (life event)
app.post('/api/gates/unlock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { gate_tag } = req.body;

    if (!gate_tag) {
      return res.status(400).json({ error: 'gate_tag is required' });
    }

    // Validate gate_tag exists in prompts
    const gateCheck = await pool.query(
      'SELECT COUNT(*) as count FROM prompts WHERE gate_tag = $1 AND requires_gate = TRUE',
      [gate_tag]
    );

    if (parseInt(gateCheck.rows[0].count) === 0) {
      return res.status(400).json({ error: 'Invalid gate_tag' });
    }

    // Insert or update gate
    const result = await pool.query(
      `INSERT INTO user_unlocked_gates (user_id, gate_tag, current_arc_step)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, gate_tag) DO UPDATE
       SET unlocked_at = NOW()
       RETURNING *`,
      [userId, gate_tag]
    );

    res.json({
      success: true,
      gate: result.rows[0],
      message: `Successfully unlocked ${gate_tag} story arc!`
    });
  } catch (error) {
    console.error('Unlock gate error:', error);
    res.status(500).json({ error: 'Failed to unlock gate' });
  }
});

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
