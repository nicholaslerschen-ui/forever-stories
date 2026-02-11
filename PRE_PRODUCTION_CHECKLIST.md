# Forever Stories - Pre-Production Checklist

## 🔴 CRITICAL - Must Do Before Production

### 1. Backend API URL Configuration
**File: `expo-mobile/src/services/api.js`**

Current (line 3):
```javascript
const API_URL = 'http://localhost:3001';
```

**ACTION REQUIRED:** After deploying backend, update to:
```javascript
const API_URL = 'https://your-production-api.railway.app';  // Replace with actual URL
```

Or use environment-based config:
```javascript
const API_URL = __DEV__
  ? 'http://localhost:3001'
  : 'https://your-production-api.railway.app';
```

---

### 2. Remove ngrok Header (No Longer Needed)
**File: `expo-mobile/src/services/api.js` (line 8)**

Remove this line from getHeaders():
```javascript
'ngrok-skip-browser-warning': 'true',  // DELETE THIS LINE
```

---

### 3. Backend Environment Variables
**Current .env has development values. Create `.env.production`:**

```bash
# .env.production
NODE_ENV=production
PORT=3001

# Database (already correct - Supabase production)
DATABASE_URL=postgresql://postgres.dwdeqxygemgjutlmuxdn:Supabase4Nick@aws-1-us-east-2.pooler.supabase.com:5432/postgres

# Security - CHANGE THESE!
JWT_SECRET=forever-stories-production-jwt-secret-$(openssl rand -hex 32)
CRON_API_KEY=forever-stories-cron-key-$(openssl rand -hex 16)

# API Keys (already set)
ANTHROPIC_API_KEY=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

# AWS S3 (already correct)
AWS_ACCESS_KEY_ID=AKIAXLF6T45NIOXWUSWR
AWS_SECRET_ACCESS_KEY=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
AWS_S3_BUCKET=forever-stories-nick
AWS_REGION=us-west-1

# Firebase (already correct)
FIREBASE_PROJECT_ID=forever-stories-4da45

# CORS - UPDATE to your production domain
CORS_ORIGIN=https://foreverstories.app,https://api.foreverstories.app

# Feature Flags
ENABLE_VOICE_RESPONSES=true
ENABLE_AI_PERSONA=true
ENABLE_FILE_OCR=true
```

**Generate secure secrets:**
```bash
# JWT Secret
openssl rand -hex 32

# Cron API Key
openssl rand -hex 16
```

---

### 4. Add expo-contacts Plugin to app.json
**File: `expo-mobile/app.json`**

Add to plugins array (around line 44):
```json
{
  "plugins": [
    "expo-contacts",  // ADD THIS LINE
    [
      "expo-notifications",
      ...
```

---

### 5. Remove Test Data from Database (Optional)
```sql
-- Remove test users (keep this for now or delete before launch)
-- DELETE FROM users WHERE email LIKE '%@test.com';
-- DELETE FROM users WHERE email = 'test@test.com';
```

---

## 🟡 RECOMMENDED - Should Do

### 6. App Icons & Splash Screen
Ensure you have proper app assets:

**Required Files:**
- `expo-mobile/assets/icon.png` (1024x1024) ✓ Already exists
- `expo-mobile/assets/splash-icon.png` ✓ Already exists
- `expo-mobile/assets/adaptive-icon.png` (Android) ✓ Need to check
- `expo-mobile/assets/favicon.png` (Web)

**ACTION:** Verify all icon files exist and are production-ready.

---

### 7. Privacy Policy & Terms
App stores require these for apps that collect user data.

**Option 1:** Use a generator like [privacypolicygenerator.info](https://www.privacypolicygenerator.info/)

**Option 2:** Create custom policy covering:
- Data collected (email, stories, photos)
- How data is used
- Third-party services (Anthropic AI, AWS S3, Firebase)
- User rights (delete account, export data)

**Host at:** `https://foreverstories.app/privacy` (or create GitHub Pages)

---

### 8. Error Monitoring Setup
**Install Sentry:**
```bash
cd /Users/admin/Desktop/forever-stories
npm install @sentry/node
```

**Add to server.js (top of file):**
```javascript
const Sentry = require("@sentry/node");

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
  });
}
```

Sign up at [sentry.io](https://sentry.io) and get DSN.

---

### 9. Analytics Setup (Optional but Recommended)
**Firebase Analytics for Mobile:**
```bash
cd expo-mobile
npx expo install expo-firebase-analytics
```

**Add to app.json:**
```json
"plugins": [
  "@react-native-firebase/app",
  "@react-native-firebase/analytics"
]
```

---

## 🟢 NICE TO HAVE

### 10. App Store Assets Preparation

**iOS App Store Screenshots Needed:**
- 6.5" iPhone (1284 x 2778) - 3-10 screenshots
- 5.5" iPhone (1242 x 2208) - optional

**Google Play Screenshots Needed:**
- Phone (1080 x 1920 or higher) - 2-8 screenshots
- 7" Tablet (1024 x 600) - optional
- 10" Tablet (1280 x 800) - optional

**Feature Graphic (Google Play):**
- 1024 x 500 banner image

**Tools:** Use Figma or [screenshots.pro](https://screenshots.pro)

---

### 11. App Store Descriptions

**Short Description (80 chars):**
```
Preserve your life stories and memories with daily prompts and AI assistance.
```

**Full Description:**
```
Forever Stories helps you document your life's journey through:

📝 Daily Prompts - Thoughtful questions that unlock meaningful memories
📸 Photo & Video Stories - Attach media to bring your stories to life
🤖 AI Persona - Your stories can answer questions even when you're not there
👥 Loved Ones - Invite family to submit questions and read your stories
📚 Story Collection - Build a legacy for future generations

Features:
• Personalized daily prompts based on your life events
• Free-write mode for spontaneous storytelling
• Photo and video attachments
• Share stories with loved ones securely
• AI-powered chatbot trained on your stories
• Push notification reminders
• Beautiful, intuitive interface

Start preserving your legacy today. Future you (and your family) will thank you.
```

**Keywords (iOS - 100 chars):**
```
memoir, journal, life story, family history, memory, diary, storytelling, legacy, AI, memories
```

---

### 12. App Store Categories
- **Primary:** Lifestyle
- **Secondary:** Productivity or Social Networking

---

### 13. Support & Contact Information
**Required for App Stores:**
- Support Email: support@foreverstories.app
- Website: https://foreverstories.app
- Privacy Policy URL: https://foreverstories.app/privacy
- Terms of Service URL: https://foreverstories.app/terms

**Set up support email:**
- Forward to your personal email
- Or use help desk (Zendesk, Intercom)

---

## 📋 Quick Pre-Launch Steps

**Day Before Launch:**
1. ✅ Backend deployed to Railway/Heroku
2. ✅ Production API URL updated in mobile app
3. ✅ All environment variables set correctly
4. ✅ Test user flows in production
5. ✅ Firebase push notifications working
6. ✅ S3 file uploads working
7. ✅ Database backups enabled

**Launch Day:**
1. ✅ Build iOS app with EAS
2. ✅ Build Android app with EAS
3. ✅ Submit to App Store (7-14 day review)
4. ✅ Submit to Google Play (2-7 day review)
5. ✅ Monitor error logs
6. ✅ Test on real devices

---

## Testing Checklist

### Backend API Test
```bash
# Health check
curl https://your-api.railway.app/health

# Expected: {"status":"healthy","timestamp":"..."}
```

### Mobile App Test (Production Build)
- [ ] User signup works
- [ ] User login works
- [ ] Daily prompt loads
- [ ] Can write and save story
- [ ] Push notifications arrive
- [ ] Photos upload successfully
- [ ] Contact sharing works
- [ ] All screens navigate correctly
- [ ] Logout works
- [ ] No console errors

---

## What to Do First?

**Recommended Order:**
1. **Deploy Backend** (1-2 hours) → Railway or Heroku
2. **Update Mobile API URL** (5 minutes)
3. **Test Everything** (30 minutes)
4. **Build with EAS** (30 minutes build time)
5. **Prepare App Store Assets** (2-4 hours)
6. **Submit to Stores** (30 minutes)
7. **Wait for Review** (7-14 days)

Let me know which step you'd like to start with!
