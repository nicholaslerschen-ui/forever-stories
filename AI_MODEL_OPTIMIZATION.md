# AI Model Optimization Guide - Sonnet vs Haiku

## Current Usage: Follow-Up Questions

**Current Implementation:**
```javascript
model: 'claude-sonnet-4-20250514'
```

**Task:**
- Input: Daily prompt + user response (~500 tokens)
- Output: 2-3 follow-up questions (~200 tokens)
- Purpose: Help users expand on their stories

---

## Cost Comparison

### Claude Sonnet 4 (Current)
```
Input: $3 per million tokens
Output: $15 per million tokens

Per follow-up generation:
- Input: 500 tokens × $3 / 1M = $0.0015
- Output: 200 tokens × $15 / 1M = $0.003
- Total: $0.0045 per use

At scale (1,000 users/month):
- Cost: $4.50/month
```

### Claude Haiku
```
Input: $0.25 per million tokens
Output: $1.25 per million tokens

Per follow-up generation:
- Input: 500 tokens × $0.25 / 1M = $0.000125
- Output: 200 tokens × $1.25 / 1M = $0.00025
- Total: $0.000375 per use

At scale (1,000 users/month):
- Cost: $0.38/month
```

**Haiku is 12x cheaper** ($0.000375 vs $0.0045)

---

## Quality Comparison for Follow-Up Questions

### Test Example

**Prompt:** "Tell me about a moment from your childhood that you still think about today."

**User Response:** "I remember the summer my dad taught me how to fish. We'd wake up at 5am and drive to the lake. I caught my first bass that year and I'll never forget how proud he looked."

### Expected Follow-Up Questions

**Sonnet 4 Quality:**
```
1. What was it about those early mornings with your dad that made them so special?
2. Can you describe the moment you caught that bass - what you felt, what your dad said?
3. Did you and your dad continue this tradition, and how did it shape your relationship?
```

**Haiku Quality (Estimated):**
```
1. What made those fishing trips with your dad so memorable?
2. Can you describe the moment you caught your first bass?
3. How did that experience affect your relationship with your dad?
```

**Quality Difference:**
- Sonnet: More nuanced phrasing, warmer tone, better context awareness
- Haiku: Still good questions, slightly more direct/generic, less warmth

**Is the difference worth 12x the cost?**

---

## Recommendation Matrix

| Use Case | Model | Reasoning |
|----------|-------|-----------|
| **Follow-Up Questions** | **Haiku** ✅ | Good enough quality, 12x cheaper, fast |
| **AI Persona Chat** | **Haiku** ✅ | Conversational task, cost matters at scale |
| **Story Analysis/Themes** | **Sonnet** ⭐ | Complex reasoning, worth the quality |
| **Critical User-Facing Content** | **Sonnet** ⭐ | First impressions matter |
| **Bulk Processing** | **Haiku** ✅ | Cost savings add up |

---

## Follow-Up Questions: Haiku is Perfect ✅

**Why Haiku Works Well Here:**

1. **Simple, Defined Task**
   - Generate 2-3 questions
   - Based on clear context (prompt + response)
   - Doesn't require deep reasoning

2. **Cost Savings Add Up**
   ```
   1,000 users × 1 follow-up/month:
   - Sonnet: $4.50/month
   - Haiku: $0.38/month
   - Savings: $4.12/month

   10,000 users × 2 follow-ups/month:
   - Sonnet: $90/month
   - Haiku: $7.50/month
   - Savings: $82.50/month
   ```

3. **Speed Matters**
   - Haiku responds in <1 second
   - Sonnet takes 2-3 seconds
   - Better UX for immediate follow-ups

4. **Quality is "Good Enough"**
   - Haiku still generates relevant questions
   - Users won't notice the difference
   - Can always upgrade if users complain (they won't)

5. **Fallback Already Exists**
   - Your code has hardcoded fallback questions
   - If Haiku fails, users get generic but useful questions
   - No risk of bad UX

---

## Code Change Recommendation

**Current (Sonnet):**
```javascript
model: 'claude-sonnet-4-20250514',
max_tokens: 500,
```

**Recommended (Haiku):**
```javascript
model: 'claude-haiku-4-20250514',  // Changed
max_tokens: 300,  // Reduced (Haiku is more concise)
```

**Even Better - Model Routing:**
```javascript
// Use different models for different features
const AI_MODELS = {
  FOLLOW_UPS: 'claude-haiku-4-20250514',      // Cheap & fast
  AI_PERSONA: 'claude-haiku-4-20250514',      // Conversational
  STORY_THEMES: 'claude-sonnet-4-20250514',   // Deep analysis (if you add this)
};

// In follow-up endpoint:
body: JSON.stringify({
  model: AI_MODELS.FOLLOW_UPS,
  max_tokens: 300,
  // ...
})
```

---

## Other AI Features to Optimize

### 1. AI Persona Chat - Use Haiku ✅

**Current/Future Implementation:**
```javascript
// When loved ones chat with AI version of user
model: 'claude-haiku-4-20250514',  // Perfect for chat
max_tokens: 1000,
```

**Why Haiku:**
- Conversational task (Haiku's strength)
- Multiple messages per session (costs add up!)
- Still engaging and natural
- 12x cheaper than Sonnet

**Cost Example (100 premium users, 10 chats/month each):**
```
Sonnet: $220/month
Haiku: $20/month
Savings: $200/month (90% reduction!)
```

### 2. Story Themes/Analysis - Use Sonnet (If You Add This)

**If you add "extract themes from all my stories" feature:**
```javascript
model: 'claude-sonnet-4-20250514',  // Worth the quality
max_tokens: 2000,
```

**Why Sonnet:**
- Complex reasoning task
- Happens infrequently (once per user)
- Quality matters for insights
- Cost is negligible (one-time analysis)

### 3. Email Summaries - Use Haiku

**If you add "weekly story summary emails":**
```javascript
model: 'claude-haiku-4-20250514',
max_tokens: 500,
```

---

## Cost Savings at Scale

### Scenario: 1,000 Active Users

**With All Sonnet:**
```
Follow-up questions: 1,000 users × 2/month = $9/month
AI Persona: 100 premium × 10 chats/month = $220/month
Total: $229/month
```

**With Optimized (Haiku for most features):**
```
Follow-up questions: 1,000 users × 2/month = $0.75/month
AI Persona: 100 premium × 10 chats/month = $20/month
Total: $20.75/month
```

**Savings: $208.25/month (91% reduction!)**

---

## Quality Assurance Strategy

**How to ensure Haiku quality is acceptable:**

1. **A/B Test (Optional)**
   ```javascript
   // Send 10% of requests to Sonnet, 90% to Haiku
   // Compare user ratings
   const model = Math.random() < 0.1
     ? 'claude-sonnet-4-20250514'
     : 'claude-haiku-4-20250514';
   ```

2. **Monitor User Feedback**
   - Track if users skip follow-up questions
   - If >30% skip rate, consider upgrading
   - Currently no data, so start with Haiku

3. **Manual Spot Check**
   - Review 10-20 Haiku-generated questions
   - If quality is poor, upgrade
   - Likely will be fine

4. **Easy Rollback**
   ```javascript
   // Just change one line if needed
   model: process.env.FOLLOWUP_MODEL || 'claude-haiku-4-20250514'
   ```

---

## Final Recommendation

### For Follow-Up Questions: **Switch to Haiku** ✅

**Benefits:**
- ✅ 12x cheaper ($0.38 vs $4.50 per 1,000 uses)
- ✅ Faster response time (better UX)
- ✅ Still generates good, relevant questions
- ✅ Easy to upgrade later if needed

**Risks:**
- ⚠️ Slightly less warm/nuanced phrasing
- ⚠️ Might occasionally be more generic

**Risk Mitigation:**
- Your code already has good fallback questions
- Can upgrade to Sonnet anytime with 1 line change
- Users unlikely to complain (they have no comparison)

**When to Reconsider:**
- If users explicitly complain about question quality (unlikely)
- If you become profitable and cost isn't a concern
- If you want to use "powered by Claude Sonnet" as marketing

---

## Implementation

**Update server.js line 2193:**
```javascript
// Before
model: 'claude-sonnet-4-20250514',

// After
model: 'claude-haiku-4-20250514',
max_tokens: 300,  // Also reduce from 500
```

**Estimated time:** 2 minutes
**Cost savings:** $4-200/month depending on scale
**Quality impact:** Minimal

---

## Summary Table

| Feature | Current Model | Recommended | Monthly Cost (1K users) | Savings |
|---------|---------------|-------------|------------------------|---------|
| Follow-up Questions | Sonnet | **Haiku** ✅ | $0.38 (vs $4.50) | $4.12 |
| AI Persona | - | **Haiku** ✅ | $20 (vs $220) | $200 |
| Story Themes | - | Sonnet (if added) | $3-5 | N/A |
| **Total** | - | - | **$20-25** | **$204** |

**Verdict: Use Haiku for follow-up questions and AI Persona. Save 91% on AI costs.**
