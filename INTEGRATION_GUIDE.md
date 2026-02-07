# Prompt Selection Engine Integration Guide

## Overview
This guide explains how to integrate the new prompt selection engine with rating, skip, and affinity tracking into your Forever Stories app.

## Files Created

### 1. Database Migration
- **`migrations/002_affinity_system.sql`** - Adds 5 new tables for affinity tracking:
  - `user_prompt_affinity` - Per-user preference scores
  - `user_prompt_history` - Complete history of shown prompts
  - `user_daily_stats` - Daily skip counts and rescue mode state
  - `prompt_ratings` - User ratings after answering
  - `user_suppressed_prompts` - Content marked as not relevant

### 2. Selection Engine
- **`promptSelectionEngine.js`** - Core selection logic implementing:
  - Weighted selection with affinity, novelty, and pacing modifiers
  - Rescue mode after skips
  - Choice UI after 3 skips
  - Rating and skip handlers

### 3. API Endpoints
- **`server-rating-skip-endpoints.js`** - New endpoints:
  - `POST /api/prompts/rate` - Rate a prompt after answering
  - `POST /api/prompts/skip` - Skip with optional reason
  - `GET /api/prompts/next-weighted` - Get next prompt with mode
  - `POST /api/prompts/choose` - Select from list after 3 skips
  - `GET /api/prompts/affinity` - View affinity dashboard
  - `DELETE /api/prompts/unsuppress` - Re-enable suppressed content

---

## Integration Steps

### Step 1: Run Database Migrations

After Supabase is ready and you've run the first migration:

```bash
# Run the affinity system migration
python3 << 'EOF'
import psycopg2

DB_CONFIG = {
    'host': 'db.dwdeqxygemgjutlmuxdn.supabase.co',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres',
    'password': 'Supabase4Nick'
}

conn = psycopg2.connect(**DB_CONFIG)
cursor = conn.cursor()

with open('migrations/002_affinity_system.sql', 'r') as f:
    cursor.execute(f.read())

conn.commit()
cursor.close()
conn.close()
print("✅ Affinity system migration complete")
EOF
```

### Step 2: Update server.js

Add this to the top of server.js after the imports:

```javascript
const { getNextPrompt, onSkip, onRating, RATING, SKIP_REASON, SELECTION_MODE } = require('./promptSelectionEngine');
```

### Step 3: Replace `/api/prompts/today` Endpoint

Replace the current `/api/prompts/today` implementation with:

```javascript
app.get('/api/prompts/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's timezone
    const userProfile = await pool.query(
      'SELECT timezone FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const userTimezone = userProfile.rows[0]?.timezone || 'America/Phoenix';

    // Get today's date
    const now = new Date();
    const todayInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
    const todayDate = `${todayInUserTZ.getFullYear()}-${String(todayInUserTZ.getMonth() + 1).padStart(2, '0')}-${String(todayInUserTZ.getDate()).padStart(2, '0')}`;

    // Check if user already answered today
    const answeredToday = await pool.query(`
      SELECT pr.*, p.prompt_text, p.domain, p.story_type, p.emotional_weight, p.depth, p.gate_tag
      FROM prompt_responses pr
      LEFT JOIN prompts p ON pr.prompt_id = p.id
      WHERE pr.user_id = $1
        AND DATE(pr.created_at AT TIME ZONE 'UTC' AT TIME ZONE $2) = $3
      ORDER BY pr.created_at DESC
      LIMIT 1
    `, [userId, userTimezone, todayDate]);

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
          depth: answered.depth,
          gate_tag: answered.gate_tag,
          // Check if already rated
          rated: await pool.query(
            'SELECT rating FROM prompt_ratings WHERE user_id = $1 AND prompt_id = $2',
            [userId, answered.prompt_id]
          ).then(r => r.rows.length > 0 ? r.rows[0].rating : null)
        }
      });
    }

    // Check for submitted questions (highest priority)
    const submittedQuestion = await pool.query(`
      SELECT id, question_text as prompt_text, submitter_email, submitter_user_id
      FROM submitted_questions
      WHERE story_owner_id = $1 AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `, [userId]);

    if (submittedQuestion.rows.length > 0) {
      const question = submittedQuestion.rows[0];
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
          depth: 'medium'
        }
      });
    }

    // Use selection engine to get next prompt
    const result = await getNextPrompt(pool, userId, SELECTION_MODE.NORMAL);

    // Handle choice UI (after 2-3 skips)
    if (result.needsChoice) {
      return res.json({
        answered: false,
        needsChoice: true,
        message: result.message,
        options: result.options,
        choices: result.choices
      });
    }

    // Return selected prompt
    res.json({
      answered: false,
      prompt: {
        id: result.id,
        question: result.prompt_text,
        category: result.domain,
        type: result.story_type,
        domain: result.domain,
        story_type: result.story_type,
        emotional_weight: result.emotional_weight || result.depth,
        depth: result.depth,
        requires_gate: result.requires_gate,
        gate_tag: result.gate_tag
      }
    });

  } catch (error) {
    console.error('Get today prompt error:', error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});
```

### Step 4: Add New Endpoints

Copy the contents of `server-rating-skip-endpoints.js` and paste them into server.js after the prompt endpoints.

### Step 5: Update Mobile API Service

Add to `mobile/src/services/api.js`:

```javascript
// Rate a prompt
async ratePrompt(promptId, responseId, rating) {
  const token = await AsyncStorage.getItem('authToken');
  const response = await fetch(`${API_URL}/api/prompts/rate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ promptId, responseId, rating }),
  });
  return response.json();
},

// Skip a prompt
async skipPrompt(promptId, skipReason = null) {
  const token = await AsyncStorage.getItem('authToken');
  const response = await fetch(`${API_URL}/api/prompts/skip`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ promptId, skipReason }),
  });
  return response.json();
},

// Choose a prompt from list
async choosePrompt(promptId) {
  const token = await AsyncStorage.getItem('authToken');
  const response = await fetch(`${API_URL}/api/prompts/choose`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ promptId }),
  });
  return response.json();
},

// Get next weighted prompt with mode
async getNextWeightedPrompt(mode = 'normal') {
  const token = await AsyncStorage.getItem('authToken');
  const response = await fetch(`${API_URL}/api/prompts/next-weighted?mode=${mode}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
},
```

---

## Mobile UI Updates

### 1. Rating Component (After Answering)

Show after user submits a response:

```jsx
// In DailyPromptScreen.js after response is submitted

<View style={styles.ratingSection}>
  <Text style={styles.ratingQuestion}>Was this a good prompt for you today?</Text>
  <View style={styles.ratingButtons}>
    <TouchableOpacity
      style={styles.ratingButton}
      onPress={() => handleRating(3)} // YES
    >
      <Text style={styles.ratingEmoji}>✅</Text>
      <Text style={styles.ratingLabel}>Yes</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.ratingButton}
      onPress={() => handleRating(2)} // OKAY
    >
      <Text style={styles.ratingEmoji}>😐</Text>
      <Text style={styles.ratingLabel}>It was okay</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.ratingButton}
      onPress={() => handleRating(1)} // NOT TODAY
    >
      <Text style={styles.ratingEmoji}>🚫</Text>
      <Text style={styles.ratingLabel}>Not right today</Text>
    </TouchableOpacity>
  </View>
  <Text style={styles.ratingOptional}>Optional - skip to continue</Text>
</View>
```

### 2. Skip Button

Replace current skip button with:

```jsx
<TouchableOpacity
  style={styles.skipButton}
  onPress={handleSkip}
>
  <Text style={styles.skipButtonText}>Skip – Not Today</Text>
</TouchableOpacity>
```

### 3. Skip Clarification (Optional, after repeated skips)

Show conditionally:

```jsx
{showSkipClarification && (
  <Modal visible={true} transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.skipClarificationModal}>
        <Text style={styles.modalTitle}>Help us understand</Text>
        <Text style={styles.modalSubtitle}>Optional - you can skip this</Text>

        <TouchableOpacity onPress={() => handleSkipWithReason('not_today')}>
          <Text>🕒 Not today</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleSkipWithReason('not_relevant')}>
          <Text>🚫 Not relevant to me</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleSkipWithReason('similar_answered')}>
          <Text>Already answered a similar prompt</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => handleSkipWithReason(null)}>
          <Text>Just skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
)}
```

### 4. Rescue Mode Choice UI (After 2 skips)

```jsx
{needsChoice && choices && (
  <View style={styles.choiceSection}>
    <Text style={styles.choiceTitle}>{message}</Text>
    {options ? (
      // Mode selection
      options.map(option => (
        <TouchableOpacity
          key={option.mode}
          onPress={() => selectMode(option.mode)}
        >
          <Text>{option.label}</Text>
          <Text>{option.description}</Text>
        </TouchableOpacity>
      ))
    ) : (
      // Prompt selection (after 3 skips)
      choices.map(prompt => (
        <TouchableOpacity
          key={prompt.id}
          onPress={() => selectPrompt(prompt.id)}
        >
          <Text>{prompt.domain} • {prompt.story_type}</Text>
          <Text>{prompt.prompt_text}</Text>
        </TouchableOpacity>
      ))
    )}
  </View>
)}
```

---

## Testing Checklist

### Backend Testing
- [ ] Run affinity migration
- [ ] Test rating endpoint (1, 2, 3)
- [ ] Test skip without reason
- [ ] Test skip with "not_today"
- [ ] Test skip with "not_relevant"
- [ ] Verify affinity scores update correctly
- [ ] Test rescue mode triggers after 1 skip
- [ ] Test choice UI triggers after 2 skips
- [ ] Test prompt list triggers after 3 skips
- [ ] Verify pacing rules (no back-to-back heavy, same domain, same gate)

### Mobile Testing
- [ ] Rating UI appears after answering
- [ ] All 3 rating options work
- [ ] Rating is optional (can skip)
- [ ] Skip button shows correct label
- [ ] Skip clarification appears conditionally
- [ ] Rescue mode shows "Want something different?"
- [ ] After 3 skips, shows list of 5 prompts
- [ ] Selected prompt shows correctly
- [ ] Affinity affects future prompts

---

## Rollback

If you need to revert:

```bash
# Remove affinity tables
psql $DATABASE_URL << 'EOF'
DROP TABLE IF EXISTS user_prompt_affinity CASCADE;
DROP TABLE IF EXISTS user_prompt_history CASCADE;
DROP TABLE IF EXISTS user_daily_stats CASCADE;
DROP TABLE IF EXISTS prompt_ratings CASCADE;
DROP TABLE IF EXISTS user_suppressed_prompts CASCADE;
DROP FUNCTION IF EXISTS update_affinity_from_rating;
DROP FUNCTION IF EXISTS update_affinity_from_skip;
ALTER TABLE prompts DROP COLUMN IF EXISTS depth;
EOF

# Restore old server.js
cp server.js.backup server.js
```

---

## Next Steps

1. **Deploy database migrations** when Supabase is ready
2. **Integrate endpoints** into server.js
3. **Build mobile UI components** for rating and skip
4. **Test thoroughly** with real usage patterns
5. **Monitor affinity scores** in production
6. **Adjust weights** based on user feedback

---

**Status:** Ready for integration after Supabase deployment
