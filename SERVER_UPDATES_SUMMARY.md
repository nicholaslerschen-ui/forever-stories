# Server.js Updates Summary

## ✅ Completed Updates

All prompt endpoints have been successfully updated to work with the advanced prompts system.

### Updated Endpoints

#### 1. **GET /api/prompts/today** (Line 816)
**Changes:**
- ✅ Implements weighted prompt selection (Onboarding: 1.5x, Arc: 1.2x, Core: 1.0x)
- ✅ Prioritizes family-submitted questions
- ✅ Checks user's unlocked gates
- ✅ Excludes prompts answered in last 30 days
- ✅ Returns new fields: `domain`, `story_type`, `emotional_weight`, `gate_tag`

**New Logic Flow:**
1. Check for submitted questions from family (highest priority)
2. Check if user already answered today
3. Get user's unlocked gates
4. Build weighted selection query
5. Select prompt based on weights and gates
6. Return personalized prompt

#### 2. **GET /api/prompts/next** (Line 1019)
**Changes:**
- ✅ Updated to use new prompt schema columns
- ✅ Excludes prompts from last 30 days (not all-time)
- ✅ Returns: `prompt_text`, `domain`, `story_type`, `emotional_weight`

#### 3. **GET /api/prompts/history** (Line 1267)
**Changes:**
- ✅ Updated JOIN to use new column names
- ✅ Returns: `prompt_text`, `domain`, `story_type`, `emotional_weight` (instead of `question`, `category`, `prompt_type`)

### New Endpoints Added

#### 4. **GET /api/gates/available** (Line 1296)
Returns list of 12 life events with descriptions and icons:
- parenthood 👶
- partnership_marriage 💕
- college_education 🎓
- immigration ✈️
- major_move 🏠
- military_service 🎖️
- faith_community ⛪
- sports_competition ⚽
- loss_grief 🕊️
- caregiving 💙
- creative_hobby 🎨
- career_pivot 💼

#### 5. **GET /api/gates/my-gates** (Line 1382)
Returns user's unlocked gates with:
- gate_tag
- unlocked_at timestamp
- current_arc_step (progress through arc)
- total_prompts count

#### 6. **POST /api/gates/unlock** (Line 1416)
Unlocks a new gate for the user:
- Validates gate_tag exists
- Creates entry in user_unlocked_gates table
- Returns success message

#### 7. **DELETE /api/gates/:gateTag** (Line 1457)
Removes a gate from user's unlocked gates

---

## Backward Compatibility

✅ **Existing endpoints still work:**
- `/api/prompts/respond` - unchanged, already handles VARCHAR prompt_id
- `/api/prompts/generate-followups` - unchanged
- All other endpoints - unchanged

⚠️ **After migration:**
- Old prompts table will be replaced with new schema
- prompt_responses.prompt_id will change from UUID to VARCHAR(50)
- Old responses remain intact

---

## Testing When Supabase is Ready

### 1. Start the server
```bash
cd /Users/admin/Desktop/forever-stories
npm start
```

### 2. Test new endpoints
```bash
# Get token first (login)
TOKEN="your-token"

# Test weighted prompt selection
curl http://localhost:3001/api/prompts/today \
  -H "Authorization: Bearer $TOKEN"

# Test available gates
curl http://localhost:3001/api/gates/available \
  -H "Authorization: Bearer $TOKEN"

# Unlock a gate
curl -X POST http://localhost:3001/api/gates/unlock \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gate_tag": "parenthood"}'

# Get user's gates
curl http://localhost:3001/api/gates/my-gates \
  -H "Authorization: Bearer $TOKEN"
```

---

## Files Modified

- ✅ `/Users/admin/Desktop/forever-stories/server.js` - Updated
- ✅ `/Users/admin/Desktop/forever-stories/server.js.backup` - Backup created

---

## Next Steps

1. **Wait for Supabase maintenance to complete** (check banner in dashboard)
2. **Run deployment script:**
   ```bash
   ./deploy_prompts.sh
   ```
3. **Restart your Node.js server:**
   ```bash
   npm start
   ```
4. **Test in mobile app** - Daily prompts should now show domain, story type, etc.

---

## Rollback Instructions

If you need to revert the changes:

```bash
cp server.js.backup server.js
npm start
```

---

**Status:** ✅ Server ready for advanced prompts system!
**Waiting on:** Supabase database to come online
**ETA:** ~10-20 minutes from Supabase project creation
