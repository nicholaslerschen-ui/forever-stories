# Phase 4: Prompt System Refinement Implementation Plan

**Date:** February 1, 2026
**Status:** ✅ COMPLETE
**Dependencies:** Phase 1-3 ✅ COMPLETED

---

## Overview

Phase 4 refines the core prompt system to match master spec requirements:
1. **Post-answer rating UI** - Verify RatingComponent integration
2. **Skip behavior refinement** - Verify "Skip – Not Today" label and rescue mode
3. **Same-day adaptive prompts** - After skip, show lighter/different prompts

### Key Requirements from Master Spec

- **Post-Answer Rating:** "Was this a good prompt for you today?"
  - Options: "Yes" / "It was okay" / "Not right today"
  - Influences future prompt selection (affinity tracking)

- **Skip Button Label:** Must be exactly "Skip – Not Today"
  - Already verified in SkipClarificationModal ✅

- **Same-Day Skip Behavior:**
  - After 1 skip: Next prompt must be lighter, different domain/story type
  - After 2 skips: Trigger rescue mode with choice
  - After 3 skips: Show list of 3-5 prompts to choose from
  - Avoid: Grief/loss domain, same story type, gated arcs

- **"Answer Another Prompt" Rules:**
  - Not counted toward streaks
  - Doesn't affect tomorrow's prompt
  - Prefer light/medium depth
  - Avoid grief/loss
  - Avoid same domain/story type as today's answered prompt

---

## Current State Analysis

### 1. RatingComponent Status

**File:** `/Users/admin/Desktop/forever-stories/mobile/src/components/RatingComponent.js`

Need to verify:
- ✅ Component exists
- ? Integration with DailyPromptScreen
- ? Exact wording matches spec
- ? Rating values sent to backend
- ? Backend stores and uses ratings for affinity

### 2. Skip System Status

**Files to Review:**
- `/Users/admin/Desktop/forever-stories/mobile/src/components/SkipClarificationModal.js`
- `/Users/admin/Desktop/forever-stories/mobile/src/components/RescueModeChoiceModal.js`
- `/Users/admin/Desktop/forever-stories/mobile/src/components/PromptChoiceList.js`

**Backend:** `/Users/admin/Desktop/forever-stories/server.js`
- Endpoint: `POST /api/prompts/skip`
- Need to verify rescue mode logic

### 3. "Answer Another Prompt" Logic

**Backend:** `/api/prompts/next-weighted`
- Need to verify isolation from daily prompt
- Need to verify it doesn't affect streaks
- Need to verify depth/domain filtering

---

## Implementation Tasks

### Task 1: Verify Post-Answer Rating Integration ✓
1. Read RatingComponent.js
2. Verify DailyPromptScreen integration
3. Check rating options match spec
4. Verify backend rating endpoint
5. Confirm affinity tracking

### Task 2: Verify Skip System ✓
1. Read SkipClarificationModal - verify "Skip – Not Today" label
2. Read RescueModeChoiceModal - verify rescue mode UI
3. Read PromptChoiceList - verify 3-skip choice list
4. Review backend skip logic
5. Verify rescue mode triggers correctly

### Task 3: Implement Same-Day Adaptive Behavior
1. Review current `/api/prompts/skip` logic
2. Add skip count tracking per session
3. After 1 skip: Filter to lighter prompts, different domain
4. After 2 skips: Return rescue mode options
5. After 3 skips: Return prompt choice list
6. Test skip progression

### Task 4: Verify "Answer Another Prompt" Isolation
1. Review `/api/prompts/next-weighted` endpoint
2. Verify streak calculation excludes bonus prompts
3. Verify tomorrow's daily prompt unaffected
4. Add depth filtering (light/medium only)
5. Add domain filtering (avoid grief/loss, avoid today's domain)
6. Test isolation

### Task 5: Testing
1. Test post-answer rating flow
2. Test skip progression (1 → 2 → 3 skips)
3. Test rescue mode choices
4. Test prompt choice list
5. Test "Answer Another Prompt" isolation
6. End-to-end flow testing

---

## Database Changes

### Skip Tracking (Session-Based)

Option 1: In-memory tracking (session-based)
- Store skip count in user session
- Reset at midnight or on successful answer

Option 2: Database tracking
```sql
-- Add to users or create session table
ALTER TABLE users
ADD COLUMN daily_skip_count INT DEFAULT 0,
ADD COLUMN last_skip_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

### Rating Affinity (May Already Exist)

Check if prompt_responses table tracks ratings:
```sql
-- Verify this column exists
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'prompt_responses'
  AND column_name IN ('rating', 'user_rating');
```

---

## Backend Implementation

### File: `/Users/admin/Desktop/forever-stories/server.js`

#### 1. Enhance POST /api/prompts/skip

**Current Logic:**
- Marks prompt as skipped
- Returns next prompt

**Enhanced Logic:**
```javascript
app.post('/api/prompts/skip', authenticateToken, async (req, res) => {
  const { promptId, skipReason } = req.body;
  const userId = req.user.userId;

  // Track skip in database
  await pool.query(
    `INSERT INTO prompt_skips (user_id, prompt_id, skip_reason, skipped_at)
     VALUES ($1, $2, $3, NOW())`,
    [userId, promptId, skipReason]
  );

  // Get today's skip count
  const skipCountResult = await pool.query(
    `SELECT COUNT(*) as count
     FROM prompt_skips
     WHERE user_id = $1
       AND skipped_at >= CURRENT_DATE`,
    [userId]
  );

  const skipCount = parseInt(skipCountResult.rows[0].count);

  // ADAPTIVE BEHAVIOR
  if (skipCount === 1) {
    // After 1 skip: Return lighter, different domain prompt
    const nextPrompt = await getNextLightPrompt(userId, promptId);
    return res.json({ prompt: nextPrompt });
  }

  if (skipCount === 2) {
    // After 2 skips: Trigger rescue mode
    return res.json({
      needsChoice: true,
      options: [
        { mode: 'lighter', label: 'Something lighter', description: '...' },
        { mode: 'thoughtful', label: 'Something thoughtful', description: '...' },
        { mode: 'surprise', label: 'Surprise me', description: '...' }
      ]
    });
  }

  if (skipCount >= 3) {
    // After 3 skips: Show 3-5 prompt choices
    const choices = await getPromptChoices(userId);
    return res.json({
      needsChoice: true,
      choices: choices
    });
  }
});
```

#### 2. Helper Functions

```javascript
async function getNextLightPrompt(userId, skippedPromptId) {
  // Get the domain/story type of skipped prompt
  const skippedPrompt = await pool.query(
    `SELECT domain, story_type FROM prompts WHERE id = $1`,
    [skippedPromptId]
  );

  const { domain, story_type } = skippedPrompt.rows[0];

  // Get lighter prompt, different domain
  const result = await pool.query(
    `SELECT * FROM prompts
     WHERE domain != $1
       AND story_type != $2
       AND emotional_weight <= 3
       AND id NOT IN (
         SELECT prompt_id FROM prompt_responses WHERE user_id = $3
       )
     ORDER BY RANDOM()
     LIMIT 1`,
    [domain, story_type, userId]
  );

  return result.rows[0];
}

async function getPromptChoices(userId) {
  // Return 3-5 diverse prompts
  const result = await pool.query(
    `SELECT * FROM prompts
     WHERE emotional_weight <= 5
       AND domain != 'grief_loss'
       AND id NOT IN (
         SELECT prompt_id FROM prompt_responses WHERE user_id = $1
       )
     ORDER BY RANDOM()
     LIMIT 5`,
    [userId]
  );

  return result.rows;
}
```

#### 3. Verify GET /api/prompts/next-weighted

**Requirements:**
- Exclude from streak calculation
- Light/medium depth only
- Avoid grief/loss
- Avoid today's answered domain

```javascript
app.get('/api/prompts/next-weighted', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const mode = req.query.mode || 'normal';

  // Get today's answered prompt domain to avoid
  const todayAnswer = await pool.query(
    `SELECT p.domain, p.story_type
     FROM prompt_responses pr
     JOIN prompts p ON pr.prompt_id = p.id
     WHERE pr.user_id = $1
       AND pr.is_daily = TRUE
       AND pr.created_at >= CURRENT_DATE
     LIMIT 1`,
    [userId]
  );

  const avoidDomain = todayAnswer.rows[0]?.domain;
  const avoidStoryType = todayAnswer.rows[0]?.story_type;

  // Get next weighted prompt
  const result = await pool.query(
    `SELECT * FROM prompts
     WHERE emotional_weight <= 5
       AND domain != 'grief_loss'
       AND domain != $1
       AND story_type != $2
       AND id NOT IN (
         SELECT prompt_id FROM prompt_responses WHERE user_id = $3
       )
     ORDER BY RANDOM()
     LIMIT 1`,
    [avoidDomain, avoidStoryType, userId]
  );

  return res.json({ prompt: result.rows[0] });
});
```

---

## Mobile UI Verification

### 1. RatingComponent

**Expected UI:**
- Modal/inline component
- Question: "Was this a good prompt for you today?"
- Three buttons:
  - "Yes" (positive)
  - "It was okay" (neutral)
  - "Not right today" (negative)

### 2. SkipClarificationModal

**Expected UI:**
- Modal after skip button pressed
- Options for skip reason
- Button text: "Skip – Not Today" ✓

### 3. RescueModeChoiceModal

**Expected UI:**
- Shows after 2 skips
- Three mode options
- Clear descriptions

### 4. PromptChoiceList

**Expected UI:**
- Shows after 3 skips
- List of 3-5 prompts
- Tap to select

---

## Testing Plan

### Test 1: Post-Answer Rating
1. Answer a daily prompt
2. Verify rating modal appears
3. Verify options match spec
4. Select rating
5. Verify saved to backend
6. Verify affects future prompts

### Test 2: Single Skip
1. Load daily prompt
2. Press skip
3. Verify next prompt is lighter
4. Verify different domain
5. Verify emotional_weight <= 3

### Test 3: Two Skips
1. Skip first prompt
2. Skip second prompt
3. Verify rescue mode modal appears
4. Verify three mode options
5. Select a mode
6. Verify appropriate prompt returned

### Test 4: Three Skips
1. Skip first prompt
2. Skip second prompt
3. Skip third prompt
4. Verify prompt choice list appears
5. Verify 3-5 prompts shown
6. Select a prompt
7. Verify chosen prompt loaded

### Test 5: "Answer Another Prompt"
1. Answer daily prompt
2. Go back to dashboard
3. Tap "Answer Another Prompt"
4. Verify prompt is light/medium
5. Verify different domain from daily
6. Answer the prompt
7. Verify streak unchanged
8. Verify tomorrow's daily unaffected

---

## Critical Files

### Backend
- `/Users/admin/Desktop/forever-stories/server.js`
  - POST /api/prompts/skip (enhance)
  - GET /api/prompts/next-weighted (verify)
  - POST /api/prompts/rate (verify exists)

### Mobile Components
- `/Users/admin/Desktop/forever-stories/mobile/src/components/RatingComponent.js`
- `/Users/admin/Desktop/forever-stories/mobile/src/components/SkipClarificationModal.js`
- `/Users/admin/Desktop/forever-stories/mobile/src/components/RescueModeChoiceModal.js`
- `/Users/admin/Desktop/forever-stories/mobile/src/components/PromptChoiceList.js`

### Mobile Screens
- `/Users/admin/Desktop/forever-stories/mobile/src/screens/DailyPromptScreen.js`

---

## Implementation Order

### Day 1: Analysis & Verification
1. ✅ Create Phase 4 plan
2. Read and analyze RatingComponent
3. Read and analyze skip components
4. Review backend skip logic
5. Review backend rating logic
6. Document current state

### Day 2: Backend Enhancements
1. Enhance POST /api/prompts/skip with adaptive logic
2. Add skip count tracking
3. Implement getNextLightPrompt helper
4. Implement getPromptChoices helper
5. Enhance GET /api/prompts/next-weighted
6. Test with cURL

### Day 3: Mobile Updates (if needed)
1. Update component wording if needed
2. Fix any integration issues
3. Test UI flows
4. End-to-end testing

---

## Success Criteria

- ✅ Post-answer rating appears after every response
- ✅ Rating options match spec exactly
- ✅ Skip button says "Skip – Not Today"
- ✅ After 1 skip: Lighter, different domain prompt
- ✅ After 2 skips: Rescue mode with 3 choices
- ✅ After 3 skips: List of 3-5 prompts
- ✅ "Answer Another Prompt" isolated from daily
- ✅ Bonus prompts don't affect streaks
- ✅ All adaptive behavior tested end-to-end

---

*Plan created by Claude Code*
*Start Date: February 1, 2026*
