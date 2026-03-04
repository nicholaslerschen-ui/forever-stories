/**
 * Prompt Selection Engine
 * Implements weighted selection with affinity, novelty, and pacing rules
 * Based on the prompt selection spec
 */

const RATING = {
  YES: 3,
  OKAY: 2,
  NOT_TODAY: 1
};

const SKIP_REASON = {
  NOT_TODAY: 'not_today',
  NOT_RELEVANT: 'not_relevant',
  SIMILAR_ANSWERED: 'similar_answered'
};

const SELECTION_MODE = {
  NORMAL: 'normal',
  BONUS: 'bonus',  // For "Answer Another Prompt" - light/medium only, avoid grief/loss
  RESCUE_LIGHT: 'rescue_light',
  RESCUE_THOUGHTFUL: 'rescue_thoughtful',
  RESCUE_SURPRISE: 'rescue_surprise'
};

/**
 * Get the next prompt for a user
 * @param {Object} pool - Database connection pool
 * @param {string} userId - User ID
 * @param {string} mode - Selection mode (normal, rescue_light, rescue_thoughtful, rescue_surprise)
 * @returns {Object} Selected prompt or choice UI directive
 */
async function getNextPrompt(pool, userId, mode = SELECTION_MODE.NORMAL) {
  try {
    // 1. Get user's daily stats (use user's timezone for correct date)
    const userProfile = await pool.query(
      'SELECT timezone FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const userTimezone = userProfile.rows[0]?.timezone || 'America/Phoenix';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const today = formatter.format(now); // YYYY-MM-DD in user's timezone
    const dailyStats = await getDailyStats(pool, userId, today);

    // 2. Get user's total response count (for onboarding prioritization)
    const responseCountResult = await pool.query(
      'SELECT COUNT(*) as total FROM prompt_responses WHERE user_id = $1',
      [userId]
    );
    const totalResponses = parseInt(responseCountResult.rows[0]?.total || 0);

    // 3. Check skip thresholds
    if (dailyStats.skip_count >= 3) {
      // After 3 skips: provide choice of 5 prompts
      return await providePromptChoice(pool, userId, dailyStats);
    }

    if (dailyStats.skip_count >= 2 && mode === SELECTION_MODE.NORMAL) {
      // After 2 skips: offer mode selection
      return {
        needsChoice: true,
        message: "Want something different?",
        options: [
          { mode: SELECTION_MODE.RESCUE_LIGHT, label: '🌿 Something lighter', description: 'Light, sensory prompts' },
          { mode: SELECTION_MODE.RESCUE_THOUGHTFUL, label: '🧠 Something thoughtful', description: 'Medium depth, reflective' },
          { mode: SELECTION_MODE.RESCUE_SURPRISE, label: '🎲 Surprise me', description: 'Random from available prompts' }
        ]
      };
    }

    // 4. Build eligible pool with progressive filter relaxation
    // Level 1: Start with strict filters (all defaults: 15-day cooldown, avoid similar, exclude shown today)
    let eligiblePrompts = await buildEligiblePool(pool, userId, dailyStats, mode);

    // Fallback 1: If no prompts, relax "avoid same story_type/depth" filter
    if (eligiblePrompts.length === 0) {
      console.log('No prompts with strict filters, relaxing story_type/depth avoidance...');
      eligiblePrompts = await buildEligiblePool(pool, userId, dailyStats, mode, { avoidLastSkipped: false });
    }

    // Fallback 2: If still no prompts, allow prompts shown today
    if (eligiblePrompts.length === 0) {
      console.log('No prompts without shown-today filter, allowing re-shown prompts...');
      eligiblePrompts = await buildEligiblePool(pool, userId, dailyStats, mode, { avoidLastSkipped: false, allowShownToday: true });
    }

    // Fallback 3: If still no prompts, reduce cooldown from 15 to 7 days
    if (eligiblePrompts.length === 0) {
      console.log('No prompts with 15-day cooldown, trying 7-day cooldown...');
      eligiblePrompts = await buildEligiblePool(pool, userId, dailyStats, mode, { avoidLastSkipped: false, allowShownToday: true, cooldownDays: 7 });
    }

    // Fallback 4: If still no prompts, reduce cooldown to 3 days
    if (eligiblePrompts.length === 0) {
      console.log('No prompts with 7-day cooldown, trying 3-day cooldown...');
      eligiblePrompts = await buildEligiblePool(pool, userId, dailyStats, mode, { avoidLastSkipped: false, allowShownToday: true, cooldownDays: 3 });
    }

    // Last resort: Return placeholder only if truly no prompts available
    if (eligiblePrompts.length === 0) {
      return {
        id: null,
        question: "You've answered all available prompts! Consider unlocking more life events to access personalized story arcs.",
        category: 'general',
        type: 'reflection',
        domain: 'Identity',
        story_type: 'Reflection & Wisdom',
        depth: 'light'
      };
    }

    // 5. Apply pacing rules
    const pacedPrompts = applyPacingRules(eligiblePrompts, dailyStats);

    // 6. Get user affinities
    const affinities = await getUserAffinities(pool, userId);

    // 7. Calculate weights (pass totalResponses for onboarding prioritization)
    const weightedPrompts = pacedPrompts.map(prompt => ({
      ...prompt,
      weight: calculateWeight(prompt, affinities, dailyStats, totalResponses)
    }));

    // 8. Weighted random selection
    const selected = weightedRandomSelection(weightedPrompts);

    // 9. Record shown event
    await recordShown(pool, userId, selected, dailyStats.skip_count >= 1, dailyStats.skip_count, today);

    // 10. Update daily stats
    await updateDailyStats(pool, userId, today, selected);

    return selected;

  } catch (error) {
    console.error('Get next prompt error:', error);
    throw error;
  }
}

/**
 * Build pool of eligible prompts
 */
async function buildEligiblePool(pool, userId, dailyStats, mode, filterOptions = {}) {
  const {
    avoidLastSkipped = true,
    allowShownToday = false,
    cooldownDays = 15
  } = filterOptions;

  // Use user's timezone for correct date calculation
  const userProfile = await pool.query(
    'SELECT timezone FROM user_profiles WHERE user_id = $1',
    [userId]
  );
  const userTimezone = userProfile.rows[0]?.timezone || 'America/Phoenix';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: userTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const today = formatter.format(now);

  // Base query
  let query = `
    SELECT DISTINCT p.*,
      COALESCE(
        (SELECT COUNT(*) FROM user_prompt_history
         WHERE user_id = $1 AND prompt_id = p.id), 0
      ) as times_shown
    FROM prompts p
    WHERE p.is_active = TRUE
  `;

  const params = [userId];
  let paramIndex = 2;

  // Exclude answered prompts
  query += `
    AND p.id NOT IN (
      SELECT prompt_id FROM prompt_responses WHERE user_id = $1 AND prompt_id IS NOT NULL
    )
  `;

  // Exclude shown today (unless allowShownToday is true)
  if (!allowShownToday) {
    query += `
      AND p.id NOT IN (
        SELECT prompt_id FROM user_prompt_history
        WHERE user_id = $1 AND DATE(shown_at) = $${paramIndex}
      )
    `;
    params.push(today);
    paramIndex++;
  }

  // Apply cooldown (configurable days)
  query += `
    AND (p.id NOT IN (
      SELECT prompt_id FROM user_prompt_history
      WHERE user_id = $1
        AND shown_at > NOW() - INTERVAL '${cooldownDays} days'
    ))
  `;

  // Check gate requirements and arc step progression
  query += `
    AND (
      p.requires_gate = FALSE
      OR (
        p.gate_tag IN (
          SELECT gate_tag FROM user_unlocked_gates WHERE user_id = $1
        )
        AND p.arc_step = (
          SELECT current_arc_step FROM user_unlocked_gates
          WHERE user_id = $1 AND gate_tag = p.gate_tag
        )
      )
    )
  `;

  // Exclude suppressed prompts
  query += `
    AND p.id NOT IN (
      SELECT prompt_id FROM user_suppressed_prompts
      WHERE user_id = $1 AND prompt_id IS NOT NULL
    )
  `;

  // Exclude suppressed domains/story_types/gates
  query += `
    AND p.domain NOT IN (
      SELECT domain FROM user_suppressed_prompts
      WHERE user_id = $1 AND domain IS NOT NULL
    )
    AND p.story_type NOT IN (
      SELECT story_type FROM user_suppressed_prompts
      WHERE user_id = $1 AND story_type IS NOT NULL
    )
    AND (p.requires_gate = FALSE OR p.gate_tag NOT IN (
      SELECT gate_tag FROM user_suppressed_prompts
      WHERE user_id = $1 AND gate_tag IS NOT NULL
    ))
  `;

  // Apply rescue mode filters (unless avoidLastSkipped is false)
  if (avoidLastSkipped && dailyStats.skip_count >= 1) {
    // Exclude same story_type and depth as last skipped
    if (dailyStats.last_prompt_story_type && dailyStats.last_prompt_depth) {
      query += ` AND NOT (p.story_type = $${paramIndex} AND p.depth = $${paramIndex + 1})`;
      params.push(dailyStats.last_prompt_story_type, dailyStats.last_prompt_depth);
      paramIndex += 2;
    }

    // Exclude same gate as last skipped
    if (dailyStats.last_prompt_gate_tag) {
      query += ` AND (p.requires_gate = FALSE OR p.gate_tag != $${paramIndex})`;
      params.push(dailyStats.last_prompt_gate_tag);
      paramIndex++;
    }
  }

  // Apply mode-specific filters
  if (mode === SELECTION_MODE.RESCUE_LIGHT) {
    // Include both light and medium to avoid empty pools (light will be boosted by weight calculation)
    query += ` AND p.depth IN ('light', 'medium')`;
  } else if (mode === SELECTION_MODE.RESCUE_THOUGHTFUL) {
    query += ` AND p.depth IN ('light', 'medium')`;
  } else if (mode === SELECTION_MODE.BONUS) {
    // For "Answer Another Prompt": light/medium depth, avoid grief/loss domain
    query += ` AND p.depth IN ('light', 'medium')`;
    query += ` AND p.domain != 'grief_loss'`;
  }

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Apply pacing rules
 */
function applyPacingRules(prompts, dailyStats) {
  if (!dailyStats.last_prompt_id) {
    return prompts; // No previous prompt, all are valid
  }

  return prompts.filter(prompt => {
    // Never show two heavy prompts back-to-back
    if (dailyStats.last_prompt_depth === 'heavy' && prompt.depth === 'heavy') {
      return false;
    }

    // Never show two prompts from same domain back-to-back
    if (dailyStats.last_prompt_domain === prompt.domain) {
      return false;
    }

    // Never show two prompts from same gate back-to-back
    if (dailyStats.last_prompt_gate_tag && prompt.requires_gate &&
        dailyStats.last_prompt_gate_tag === prompt.gate_tag) {
      return false;
    }

    return true;
  });
}

/**
 * Get user affinities
 */
async function getUserAffinities(pool, userId) {
  const result = await pool.query(`
    SELECT domain, story_type, depth, affinity_score
    FROM user_prompt_affinity
    WHERE user_id = $1
  `, [userId]);

  const affinities = {
    domain: {},
    story_type: {},
    depth: {}
  };

  result.rows.forEach(row => {
    if (row.domain) affinities.domain[row.domain] = row.affinity_score;
    if (row.story_type) affinities.story_type[row.story_type] = row.affinity_score;
    if (row.depth) affinities.depth[row.depth] = row.affinity_score;
  });

  return affinities;
}

/**
 * Calculate prompt weight
 */
function calculateWeight(prompt, affinities, dailyStats, totalResponses = 0) {
  // Base weight from prompt metadata
  let weight = prompt.base_weight || 1.0;

  // NEW USER ONBOARDING MODIFIER
  // For users with fewer than 10 responses, prioritize onboarding prompts and deprioritize arc prompts
  if (totalResponses < 10) {
    // Boost onboarding prompts significantly for new users
    if (prompt.base_weight_category === 'Onboarding' || prompt.base_weight >= 1.5) {
      weight *= 10.0; // 10x boost for onboarding prompts (ensures ~90% onboarding for new users)
    }

    // Heavily penalize gated arc prompts for new users
    if (prompt.requires_gate === true) {
      // Use exponential decay based on response count
      // At 0 responses: 0.05x (95% reduction)
      // At 5 responses: 0.22x (78% reduction)
      // At 9 responses: 0.47x (53% reduction)
      // At 10+ responses: no penalty
      const arcPenalty = 0.05 + (totalResponses / 10) * 0.95;
      weight *= arcPenalty;
    }
  } else if (totalResponses < 20) {
    // Gradual transition: still slightly favor onboarding for users with 10-19 responses
    if (prompt.base_weight_category === 'Onboarding' || prompt.base_weight >= 1.5) {
      weight *= 3.0; // Smaller boost as users get more experienced
    }

    // Smaller penalty for arc prompts during transition period
    if (prompt.requires_gate === true) {
      const arcPenalty = 0.6 + ((totalResponses - 10) / 10) * 0.4;
      weight *= arcPenalty;
    }
  }

  // Affinity modifier
  const domainAff = affinities.domain[prompt.domain] || 0.0;
  const storyAff = affinities.story_type[prompt.story_type] || 0.0;
  const depthAff = affinities.depth[prompt.depth] || 0.0;

  const affinityModifier =
    (1 + 0.6 * domainAff) *
    (1 + 0.6 * storyAff) *
    (1 + 0.3 * depthAff);

  weight *= affinityModifier;

  // Novelty modifier
  const timesShown = prompt.times_shown || 0;
  const noveltyModifier = 1 / Math.sqrt(timesShown + 1);
  weight *= noveltyModifier;

  // Pacing modifier
  let pacingModifier = 1.0;

  // Boost light after heavy
  if (dailyStats.last_prompt_depth === 'heavy' && prompt.depth === 'light') {
    pacingModifier *= 1.3;
  }

  // Reduce heavy generally, especially in rescue mode
  if (prompt.depth === 'heavy') {
    pacingModifier *= 0.8;
    if (dailyStats.skip_count >= 1) {
      pacingModifier *= 0.5; // Further reduce in rescue mode
    }
  }

  // Boost light in rescue mode
  if (dailyStats.skip_count >= 1 && prompt.depth === 'light') {
    pacingModifier *= 1.5;
  }

  weight *= pacingModifier;

  return Math.max(0.01, weight); // Ensure positive weight
}

/**
 * Weighted random selection
 */
function weightedRandomSelection(weightedPrompts) {
  const totalWeight = weightedPrompts.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (const prompt of weightedPrompts) {
    random -= prompt.weight;
    if (random <= 0) {
      return prompt;
    }
  }

  // Fallback to last prompt
  return weightedPrompts[weightedPrompts.length - 1];
}

/**
 * Get or create daily stats
 */
async function getDailyStats(pool, userId, date) {
  const result = await pool.query(`
    SELECT * FROM user_daily_stats
    WHERE user_id = $1 AND stat_date = $2
  `, [userId, date]);

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Create new daily stats (use ON CONFLICT to handle race conditions)
  const insertResult = await pool.query(`
    INSERT INTO user_daily_stats (user_id, stat_date, skip_count)
    VALUES ($1, $2, 0)
    ON CONFLICT (user_id, stat_date) DO NOTHING
    RETURNING *
  `, [userId, date]);

  // If another request already created it, fetch it
  if (insertResult.rows.length === 0) {
    const retryResult = await pool.query(`
      SELECT * FROM user_daily_stats
      WHERE user_id = $1 AND stat_date = $2
    `, [userId, date]);
    return retryResult.rows[0];
  }

  return insertResult.rows[0];
}

/**
 * Record shown event
 */
async function recordShown(pool, userId, prompt, isRescueMode, skipCountThatDay, date) {
  await pool.query(`
    INSERT INTO user_prompt_history
    (user_id, prompt_id, action, was_rescue_mode, skip_count_that_day,
     domain, story_type, depth, gate_tag)
    VALUES ($1, $2, 'shown', $3, $4, $5, $6, $7, $8)
  `, [
    userId,
    prompt.id,
    isRescueMode,
    skipCountThatDay,
    prompt.domain,
    prompt.story_type,
    prompt.depth,
    prompt.gate_tag
  ]);
}

/**
 * Update daily stats
 */
async function updateDailyStats(pool, userId, date, prompt) {
  await pool.query(`
    UPDATE user_daily_stats
    SET last_prompt_id = $3,
        last_prompt_domain = $4,
        last_prompt_story_type = $5,
        last_prompt_depth = $6,
        last_prompt_gate_tag = $7
    WHERE user_id = $1 AND stat_date = $2
  `, [
    userId,
    date,
    prompt.id,
    prompt.domain,
    prompt.story_type,
    prompt.depth,
    prompt.gate_tag
  ]);
}

/**
 * Provide choice of 5 prompts (after 3 skips)
 */
async function providePromptChoice(pool, userId, dailyStats) {
  const eligible = await buildEligiblePool(pool, userId, dailyStats, SELECTION_MODE.NORMAL);
  const paced = applyPacingRules(eligible, dailyStats);

  // Select 5 diverse prompts
  const choices = [];
  const usedDomains = new Set();
  const usedStoryTypes = new Set();

  for (const prompt of paced) {
    if (choices.length >= 5) break;

    // Try to get diverse set
    if (!usedDomains.has(prompt.domain) || !usedStoryTypes.has(prompt.story_type)) {
      choices.push(prompt);
      usedDomains.add(prompt.domain);
      usedStoryTypes.add(prompt.story_type);
    }
  }

  // Fill remaining slots if needed
  while (choices.length < 5 && choices.length < paced.length) {
    const remaining = paced.filter(p => !choices.find(c => c.id === p.id));
    if (remaining.length > 0) {
      choices.push(remaining[0]);
    } else {
      break;
    }
  }

  return {
    needsChoice: true,
    message: "Pick a prompt that feels right",
    choices: choices
  };
}

/**
 * Handle skip event
 */
async function onSkip(pool, userId, promptId, skipReason = null) {
  const today = new Date().toISOString().split('T')[0];

  // Get prompt details
  const promptResult = await pool.query(
    'SELECT * FROM prompts WHERE id = $1',
    [promptId]
  );

  if (promptResult.rows.length === 0) {
    throw new Error('Prompt not found');
  }

  const prompt = promptResult.rows[0];

  // Update daily stats - increment skip count
  await pool.query(`
    UPDATE user_daily_stats
    SET skip_count = skip_count + 1,
        rescue_mode_active = TRUE
    WHERE user_id = $1 AND stat_date = $2
  `, [userId, today]);

  // Record skip in history
  await pool.query(`
    INSERT INTO user_prompt_history
    (user_id, prompt_id, action, skip_reason, domain, story_type, depth, gate_tag)
    VALUES ($1, $2, 'skipped', $3, $4, $5, $6, $7)
  `, [
    userId,
    promptId,
    skipReason,
    prompt.domain,
    prompt.story_type,
    prompt.depth,
    prompt.gate_tag
  ]);

  // Update affinity if skip reason provided
  if (skipReason) {
    await pool.query(
      'SELECT update_affinity_from_skip($1, $2, $3, $4, $5)',
      [userId, prompt.domain, prompt.story_type, prompt.depth, skipReason]
    );

    // If "not relevant", add to suppressed list
    if (skipReason === SKIP_REASON.NOT_RELEVANT) {
      await pool.query(`
        INSERT INTO user_suppressed_prompts
        (user_id, domain, story_type, gate_tag, suppression_strength, reason)
        VALUES ($1, $2, $3, $4, -0.4, 'not_relevant')
        ON CONFLICT DO NOTHING
      `, [userId, prompt.domain, prompt.story_type, prompt.gate_tag]);
    }
  }

  // Get next prompt in rescue mode
  return await getNextPrompt(pool, userId, SELECTION_MODE.NORMAL);
}

/**
 * Handle rating event
 */
async function onRating(pool, userId, promptId, responseId, rating) {
  // Get prompt details if it's a regular prompt (not a submitted question)
  const promptResult = await pool.query(
    'SELECT * FROM prompts WHERE id = $1',
    [promptId]
  );

  const prompt = promptResult.rows.length > 0 ? promptResult.rows[0] : null;
  console.log('📝 Rating prompt:', promptId);
  console.log('📝 Prompt data:', prompt ? { id: prompt.id, domain: prompt.domain, story_type: prompt.story_type, depth: prompt.depth } : 'NOT FOUND');

  // Save rating
  await pool.query(`
    INSERT INTO prompt_ratings (user_id, prompt_id, response_id, rating)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, prompt_id) DO UPDATE
    SET rating = $4, rated_at = NOW()
  `, [userId, promptId, responseId, rating]);

  // Update affinity only for regular prompts (not submitted questions)
  if (prompt && prompt.domain && prompt.story_type && prompt.depth) {
    console.log('🎯 Updating affinity with:', {
      userId,
      domain: prompt.domain,
      story_type: prompt.story_type,
      depth: prompt.depth,
      rating
    });

    // Calculate affinity delta based on rating
    const delta = rating === 3 ? 0.20 : rating === 2 ? 0.05 : rating === 1 ? -0.20 : 0.0;

    // Update affinity directly (bypassing stored function to avoid caching issues)
    await pool.query(`
      INSERT INTO user_prompt_affinity (user_id, domain, story_type, depth, affinity_score, update_count)
      VALUES ($1, $2, $3, $4, $5, 1)
      ON CONFLICT (user_id, domain, story_type, depth)
      DO UPDATE SET
        affinity_score = GREATEST(-1.0, LEAST(1.0, user_prompt_affinity.affinity_score + $5)),
        update_count = user_prompt_affinity.update_count + 1,
        last_updated = NOW()
    `, [userId, prompt.domain, prompt.story_type, prompt.depth, delta]);
  }

  return { success: true, message: 'Thank you for your feedback!' };
}

module.exports = {
  getNextPrompt,
  onSkip,
  onRating,
  RATING,
  SKIP_REASON,
  SELECTION_MODE
};
