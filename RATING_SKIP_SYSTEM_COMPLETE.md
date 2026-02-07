# ✅ Rating & Skip System - Implementation Complete

## Overview

The complete prompt rating and skip system has been successfully implemented for the Forever Stories app. All backend endpoints, mobile UI components, and integration code are now in place.

---

## What Was Built

### 🎯 Backend Implementation

**New File: `promptSelectionEngine.js`** (550 lines)
- Weighted random prompt selection algorithm
- Affinity tracking and scoring
- Rescue mode logic (light/thoughtful/surprise)
- Pacing rules (no back-to-back heavy/domain/gate)
- Skip handling with suppression
- Rating processing with affinity updates

**Updated File: `server.js`**
- Added 6 new API endpoints for rating/skip functionality
- Imported prompt selection engine
- All endpoints use existing `authenticateToken` middleware

**New Endpoints:**
```javascript
POST   /api/prompts/rate           // Rate prompt 1-3 after answering
POST   /api/prompts/skip           // Skip with optional reason
GET    /api/prompts/next-weighted  // Get next prompt with mode
POST   /api/prompts/choose         // Choose from list after 3 skips
GET    /api/prompts/affinity       // Get user affinity dashboard
DELETE /api/prompts/unsuppress     // Re-enable suppressed content
```

### 📱 Mobile Implementation

**4 New Components Created:**

1. **RatingComponent.js** - Post-answer feedback UI
   - 3 rating options: Yes (3), Okay (2), Not Today (1)
   - Optional - can skip rating
   - Animated fade in/out
   - Calls `/api/prompts/rate`

2. **SkipClarificationModal.js** - Optional skip reason
   - 🕒 Not today (-0.05 affinity)
   - 🚫 Not relevant (-0.40 affinity, suppress)
   - ✓ Already answered similar
   - Can dismiss without selecting
   - Full-screen modal

3. **RescueModeChoiceModal.js** - Mode selection after 2 skips
   - 🌿 Something lighter (depth=light only)
   - 🧠 Something thoughtful (depth=light/medium)
   - 🎲 Surprise me (random available)
   - Color-coded cards

4. **PromptChoiceList.js** - 5-prompt selection after 3 skips
   - Shows 5 diverse prompts
   - Domain, story type, depth indicators
   - Scrollable list with large touch targets

**Updated Files:**

- `mobile/src/services/api.js` - Added 5 new methods
- `mobile/src/screens/DailyPromptScreen.js` - Full integration:
  - Added state for all modals
  - Added Skip button
  - Integrated all 4 components
  - Updated submitResponse to show rating
  - Added handlers for rating, skip, mode selection, prompt choice

### 🗄️ Database Migrations (Ready to Deploy)

**Migration: `001_advanced_prompts.sql`**
- New prompts table with 15 columns (domain, story_type, depth, gates, etc.)
- user_unlocked_gates table
- Updated prompt_responses.prompt_id to VARCHAR(50)

**Migration: `002_affinity_system.sql`**
- user_prompt_affinity table
- user_prompt_history table
- user_daily_stats table
- prompt_ratings table
- user_suppressed_prompts table
- Helper functions: `update_affinity_from_rating()`, `update_affinity_from_skip()`

**Data: `prompts-2-fixed.xlsx`**
- 225 prompts ready to import
- 140 core prompts
- 85 gated arc prompts (12 life events)
- All prompts validated and fixed

### 🚀 Deployment Scripts (Ready to Run)

- `deploy_prompts.sh` - Automated deployment with retry logic
- `test_supabase.sh` - Quick connection test
- `scripts/import_prompts.py` - Excel import script
- `scripts/run_migration.py` - Migration runner

---

## Implementation Summary

### ✅ Completed Tasks

- [x] Create database schema for affinity tracking
- [x] Build prompt selection engine with weighted algorithm
- [x] Implement rating formula (Yes=+0.20, Okay=+0.05, Not Today=-0.20)
- [x] Implement skip logic with rescue mode
- [x] Create 6 backend API endpoints
- [x] Add endpoints to server.js
- [x] Create 4 mobile UI components
- [x] Update API service with new methods
- [x] Integrate components into DailyPromptScreen
- [x] Fix 225 prompts data (3 missing arc_step values)
- [x] Create deployment scripts
- [x] Create comprehensive documentation

### ⏳ Pending Tasks

- [ ] **Wait for Supabase maintenance to complete** (~10-20 minutes from creation)
- [ ] **Deploy database migrations** - Run `./deploy_prompts.sh`
- [ ] **Restart Node.js server** - Run `npm start`
- [ ] **Test complete flow** - See testing checklist below

---

## How It Works

### User Flow: Answer Prompt

1. User sees daily prompt
2. User writes story and taps "Save Story"
3. **RatingComponent appears** with 3 options
4. User rates or skips rating
5. Navigate back to dashboard

### User Flow: Skip Prompt

#### 1st Skip
- User taps "Skip – Not Today"
- **SkipClarificationModal appears** (optional)
- User selects reason or dismisses
- New prompt loads (rescue mode active)

#### 2nd Skip
- User taps skip again
- **RescueModeChoiceModal appears**
- User selects: Light / Thoughtful / Surprise
- New prompt loads based on mode

#### 3rd Skip
- User taps skip again
- **PromptChoiceList appears** with 5 prompts
- User browses and selects one
- Selected prompt loads

### Backend Logic: Weighted Selection

```javascript
weight = base_weight × affinity_modifier × novelty_modifier × pacing_modifier

// Affinity modifier (based on user ratings/skips)
affinity_modifier =
  (1 + 0.6 × domain_affinity) ×
  (1 + 0.6 × story_type_affinity) ×
  (1 + 0.3 × depth_affinity)

// Novelty modifier (reduces weight for repeated prompts)
novelty_modifier = 1 / √(times_shown + 1)

// Pacing modifier (boosts/reduces based on context)
- Light after heavy: ×1.3
- Heavy generally: ×0.8
- Heavy in rescue mode: ×0.5 (further reduced)
- Light in rescue mode: ×1.5
```

### Affinity Score Updates

**From Ratings:**
- Yes (3) → +0.20 to domain/story_type, +0.10 to depth
- Okay (2) → +0.05 to domain/story_type, +0.025 to depth
- Not Today (1) → -0.20 to domain/story_type, -0.10 to depth

**From Skips:**
- "Not today" → -0.05 to domain/story_type/depth
- "Not relevant" → -0.40 to domain/story_type/depth + suppress
- No reason → No affinity change

All scores clamped to [-1.0, +1.0]

---

## Next Steps to Go Live

### Step 1: Check Supabase Status

```bash
cd /Users/admin/Desktop/forever-stories
./test_supabase.sh
```

**Expected Output:**
```
Testing Supabase connection...
✅ Connected to Supabase PostgreSQL
Server version: PostgreSQL 15.x
```

If you see "could not translate host name" → Maintenance still in progress, wait 5-10 minutes

### Step 2: Deploy Database & Prompts

```bash
./deploy_prompts.sh
```

This will:
1. Run 001_advanced_prompts.sql migration
2. Run 002_affinity_system.sql migration
3. Import 225 prompts from Excel
4. Verify deployment

**Expected Output:**
```
✅ Migration 001 complete
✅ Migration 002 complete
✅ Imported 225 prompts
✅ Verification complete
```

### Step 3: Restart Server

```bash
npm start
```

**Expected Output:**
```
📊 Using PostgreSQL database
✅ Database connected
🎉 Server running on http://0.0.0.0:3001
```

### Step 4: Test in Mobile App

**Basic Test:**
1. Login to app
2. Tap "Today's Prompt"
3. Verify prompt loads with new fields (domain, story_type)
4. Answer prompt
5. Verify RatingComponent appears
6. Rate or skip rating
7. Verify navigation back to dashboard

**Skip Test:**
1. Load prompt
2. Tap "Skip – Not Today"
3. Verify SkipClarificationModal appears
4. Select "Not today" or dismiss
5. Verify new prompt loads
6. Skip again → Verify RescueModeChoiceModal appears
7. Skip 3rd time → Verify PromptChoiceList appears

---

## Testing Checklist

### Backend Endpoints

```bash
# Get auth token first
TOKEN="your-jwt-token"

# Test rating
curl -X POST http://localhost:3001/api/prompts/rate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"promptId": "Core_Identity_1", "responseId": "some-uuid", "rating": 3}'

# Test skip
curl -X POST http://localhost:3001/api/prompts/skip \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"promptId": "Core_Identity_1", "skipReason": "not_today"}'

# Test weighted selection
curl http://localhost:3001/api/prompts/next-weighted?mode=normal \
  -H "Authorization: Bearer $TOKEN"

# Test affinity dashboard
curl http://localhost:3001/api/prompts/affinity \
  -H "Authorization: Bearer $TOKEN"
```

### Mobile UI

- [ ] RatingComponent shows after answering
- [ ] All 3 rating buttons work
- [ ] Skip rating button works
- [ ] SkipClarificationModal shows on skip
- [ ] All 3 clarification reasons work
- [ ] Dismiss modal without reason works
- [ ] RescueModeChoiceModal shows after 2 skips
- [ ] All 3 mode options work
- [ ] PromptChoiceList shows after 3 skips
- [ ] Can select prompt from choice list
- [ ] All modals have proper styling
- [ ] Text sizing respects FontSizeContext
- [ ] Navigation works correctly
- [ ] Loading states show properly
- [ ] Error alerts display correctly

### Affinity System

- [ ] Rating "Yes" increases affinity
- [ ] Rating "Not Today" decreases affinity
- [ ] Skip "not relevant" suppresses content
- [ ] Suppressed prompts don't reappear
- [ ] Rescue mode avoids last skipped type
- [ ] Weighted selection favors high-affinity prompts
- [ ] Novelty modifier reduces repeated prompts
- [ ] Pacing rules prevent back-to-back heavy/domain/gate

---

## Troubleshooting

### Issue: "Module not found: promptSelectionEngine"

**Solution:**
```bash
# Verify file exists
ls -la /Users/admin/Desktop/forever-stories/promptSelectionEngine.js

# Restart server
npm start
```

### Issue: "Table user_prompt_affinity does not exist"

**Solution:**
```bash
# Database migration didn't run
./deploy_prompts.sh
```

### Issue: Rating doesn't update affinity

**Solution:**
```bash
# Check database function exists
psql $DATABASE_URL -c "\df update_affinity_from_rating"

# Re-run migration 002
psql $DATABASE_URL -f migrations/002_affinity_system.sql
```

### Issue: Skip doesn't load new prompt

**Solution:**
- Check server logs for errors
- Verify user has eligible prompts remaining
- Check user_daily_stats table for skip_count
- Test with curl to isolate frontend/backend issue

---

## File Summary

### Backend Files
- ✅ `server.js` - Updated with 6 new endpoints + import
- ✅ `promptSelectionEngine.js` - Core selection algorithm (NEW)
- ✅ `migrations/001_advanced_prompts.sql` - Schema migration (NEW)
- ✅ `migrations/002_affinity_system.sql` - Affinity tables (NEW)
- ✅ `deploy_prompts.sh` - Deployment script (NEW)
- ✅ `test_supabase.sh` - Connection test (NEW)
- ✅ `scripts/import_prompts.py` - Excel import (UPDATED)

### Mobile Files
- ✅ `mobile/src/components/RatingComponent.js` (NEW)
- ✅ `mobile/src/components/SkipClarificationModal.js` (NEW)
- ✅ `mobile/src/components/RescueModeChoiceModal.js` (NEW)
- ✅ `mobile/src/components/PromptChoiceList.js` (NEW)
- ✅ `mobile/src/screens/DailyPromptScreen.js` (UPDATED)
- ✅ `mobile/src/services/api.js` (UPDATED)

### Data Files
- ✅ `/Users/admin/Downloads/prompts-2-fixed.xlsx` - 225 prompts (FIXED)

### Documentation
- ✅ `PROMPTS_MIGRATION_GUIDE.md` - Migration instructions
- ✅ `INTEGRATION_GUIDE.md` - Integration steps
- ✅ `SERVER_UPDATES_SUMMARY.md` - Server changes summary
- ✅ `MOBILE_INTEGRATION_COMPLETE.md` - Mobile implementation
- ✅ `RATING_SKIP_SYSTEM_COMPLETE.md` - This file

---

## Architecture Decisions

### Why Weighted Random Selection?

- **Personalized:** Learns from user behavior (ratings/skips)
- **Diverse:** Novelty modifier prevents repetition
- **Paced:** Rules prevent overwhelming sequences
- **Flexible:** Rescue modes adapt to user mood

### Why Affinity Scores?

- **Granular:** Separate scores for domain, story_type, depth
- **Bounded:** [-1.0, +1.0] prevents runaway values
- **Incremental:** Small deltas accumulate over time
- **Reversible:** Positive ratings can offset negative skips

### Why Rescue Mode?

- **User-friendly:** Doesn't force unwanted prompts
- **Adaptive:** Changes selection based on skip count
- **Empowering:** Gives user control after frustration
- **Data-rich:** Skip reasons provide valuable signals

### Why Suppress "Not Relevant"?

- **Respect:** User explicitly said it's not for them
- **Performance:** Reduces eligible pool for faster selection
- **Quality:** Focuses on content user wants
- **Reversible:** Unsuppress endpoint allows re-enabling

---

## Success Metrics

After deployment, monitor:

1. **Rating Distribution**
   - Target: 60% Yes, 30% Okay, 10% Not Today
   - Check: `SELECT rating, COUNT(*) FROM prompt_ratings GROUP BY rating`

2. **Skip Rate**
   - Target: <20% of prompts skipped
   - Check: `SELECT action, COUNT(*) FROM user_prompt_history GROUP BY action`

3. **Rescue Mode Frequency**
   - Target: <10% of sessions trigger rescue mode
   - Check: `SELECT rescue_mode_active, COUNT(*) FROM user_daily_stats GROUP BY rescue_mode_active`

4. **Prompt Diversity**
   - Target: All domains shown roughly equally
   - Check: `SELECT domain, COUNT(*) FROM user_prompt_history GROUP BY domain`

5. **Suppression Rate**
   - Target: <5% of content suppressed per user
   - Check: `SELECT COUNT(DISTINCT prompt_id) FROM user_suppressed_prompts`

---

## Performance Considerations

### Database Queries

- All selection queries use indexes on `user_id`, `prompt_id`, `stat_date`
- Affinity lookups are O(1) with hash index on `user_id`
- History queries limited to 15-day window
- Daily stats table has one row per user per day (minimal overhead)

### API Response Times

- Expected: <200ms for weighted selection
- Expected: <50ms for rating/skip
- Bottleneck: Building eligible pool (multiple JOINs)
- Optimization: Consider caching eligible pool for 5 minutes

### Mobile Performance

- RatingComponent uses Animated API (60fps)
- Modals render only when visible (conditional rendering)
- FlatList in PromptChoiceList (efficient scrolling)
- No large images or heavy computations

---

## Security Notes

- ✅ All endpoints require `authenticateToken` middleware
- ✅ User ID extracted from JWT (not request body)
- ✅ All database queries use parameterized statements
- ✅ Input validation for rating (1-3), mode, skipReason
- ✅ Row-level security on all affinity tables
- ✅ No sensitive data in client-side code
- ✅ Rate limiting already in place from existing middleware

---

**Status:** ✅ Implementation 100% Complete
**Blocked By:** Supabase maintenance
**Next Action:** Run `./test_supabase.sh` to check if database is ready
**ETA to Production:** <5 minutes after Supabase is online
