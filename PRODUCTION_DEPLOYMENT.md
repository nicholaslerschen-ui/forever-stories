# Forever Stories - Production Deployment Guide

## Overview
This guide covers deploying both the backend server and the mobile app to production.

---

## Part 1: Backend Server Deployment

### Option A: Railway (Recommended - Easiest)
Railway provides simple deployment with PostgreSQL support.

**Steps:**
1. Sign up at [railway.app](https://railway.app)
2. Install Railway CLI: `npm i -g @railway/cli`
3. Login: `railway login`
4. Initialize: `cd /Users/admin/Desktop/forever-stories && railway init`
5. Add PostgreSQL: `railway add postgresql`
6. Deploy: `railway up`

**Environment Variables to Set:**
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=<your-secure-secret>
railway variables set ANTHROPIC_API_KEY=<your-key>
railway variables set AWS_ACCESS_KEY_ID=<your-key>
railway variables set AWS_SECRET_ACCESS_KEY=<your-secret>
railway variables set AWS_S3_BUCKET=forever-stories-nick
railway variables set AWS_REGION=us-west-1
railway variables set FIREBASE_PROJECT_ID=forever-stories-4da45
railway variables set CRON_API_KEY=<your-cron-key>
```

### Option B: Heroku
**Steps:**
1. Install Heroku CLI: `brew tap heroku/brew && brew install heroku`
2. Login: `heroku login`
3. Create app: `heroku create forever-stories-api`
4. Add PostgreSQL: `heroku addons:create heroku-postgresql:mini`
5. Set environment variables (same as Railway)
6. Deploy: `git push heroku master`

### Option C: DigitalOcean App Platform
Lower cost option with full control.

---

## Part 2: Backend Pre-Deployment Checklist

### Security
- [ ] Review CORS_ORIGIN in .env (set to production domain)
- [ ] Change JWT_SECRET to a strong production key
- [ ] Change CRON_API_KEY to a secure value
- [ ] Ensure DATABASE_URL points to production database (Supabase)
- [ ] Review rate limiting settings in server.js
- [ ] Set NODE_ENV=production

### Environment Variables Review
```bash
# Required for Production
NODE_ENV=production
PORT=3001
DATABASE_URL=<supabase-production-url>
JWT_SECRET=<secure-random-string>
ANTHROPIC_API_KEY=sk-ant-api03-...
AWS_ACCESS_KEY_ID=AKIAXLF6T45NIOXWUSWR
AWS_SECRET_ACCESS_KEY=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
AWS_S3_BUCKET=forever-stories-nick
AWS_REGION=us-west-1
FIREBASE_PROJECT_ID=forever-stories-4da45
CRON_API_KEY=<secure-random-string>
CORS_ORIGIN=https://yourdomain.com

# Optional but recommended
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=<your-sendgrid-key>
EMAIL_FROM=noreply@foreverstories.app
SENTRY_DSN=<your-sentry-dsn>
```

### Database
- [ ] Current Supabase database is production-ready
- [ ] Run database migrations if any pending
- [ ] Backup database before deployment
- [ ] Verify all tables exist and have proper indexes

### Firebase Setup
- [ ] Upload firebase-service-account.json to production server
- [ ] Verify FIREBASE_PROJECT_ID is correct
- [ ] Test push notifications work

### Files to Include in Deployment
```
server.js
promptSelectionEngine.js
package.json
package-lock.json
firebase-service-account.json
.env (with production values)
```

### Files to EXCLUDE
```
node_modules/ (will be installed on server)
*.log
test*.js
check*.js
mobile/ (separate deployment)
expo-mobile/ (separate deployment)
```

---

## Part 3: Mobile App Deployment (Expo)

### Pre-Deployment Checklist

#### Update app.json
```json
{
  "expo": {
    "name": "Forever Stories",
    "slug": "forever-stories",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.foreverstories.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSContactsUsageDescription": "Forever Stories needs access to your contacts to easily invite family and friends to the app.",
        "NSCameraUsageDescription": "Forever Stories needs access to your camera to capture photos and videos for your stories.",
        "NSPhotoLibraryUsageDescription": "Forever Stories needs access to your photo library to attach photos and videos to your stories.",
        "NSMicrophoneUsageDescription": "Forever Stories needs microphone access to record videos with audio."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.foreverstories.app",
      "versionCode": 1,
      "permissions": [
        "READ_CONTACTS",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECEIVE_BOOT_COMPLETED"
      ]
    },
    "plugins": [
      "expo-contacts",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#e11d48"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      }
    }
  }
}
```

#### Update API URL for Production
**File: expo-mobile/src/services/api.js**

Change:
```javascript
const API_URL = 'https://your-production-api.com';  // Update this!
```

Or use environment-based configuration:
```javascript
const API_URL = __DEV__
  ? 'http://192.168.0.22:3001'  // Development
  : 'https://your-production-api.com';  // Production
```

### iOS Deployment (App Store)

#### Prerequisites
- [ ] Apple Developer Account ($99/year)
- [ ] Mac with Xcode installed
- [ ] App icons prepared (1024x1024 for App Store)
- [ ] Screenshots prepared (various iPhone sizes)

#### Steps

1. **Install EAS CLI**
```bash
npm install -g eas-cli
```

2. **Login to Expo**
```bash
eas login
```

3. **Configure EAS Build**
```bash
cd expo-mobile
eas build:configure
```

4. **Create eas.json**
```json
{
  "build": {
    "production": {
      "ios": {
        "distribution": "store",
        "bundler": "metro"
      },
      "android": {
        "distribution": "store",
        "bundler": "metro"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "your-team-id"
      }
    }
  }
}
```

5. **Build iOS App**
```bash
eas build --platform ios --profile production
```

6. **Submit to App Store**
```bash
eas submit --platform ios --latest
```

7. **Complete App Store Connect Setup**
- Add app description
- Add screenshots
- Set pricing (Free)
- Add privacy policy URL
- Select age rating
- Submit for review

### Android Deployment (Google Play)

#### Prerequisites
- [ ] Google Play Developer Account ($25 one-time)
- [ ] App icons prepared
- [ ] Screenshots prepared
- [ ] Privacy policy URL

#### Steps

1. **Build Android App**
```bash
eas build --platform android --profile production
```

2. **Submit to Google Play**
```bash
eas submit --platform android --latest
```

3. **Complete Google Play Console Setup**
- Add app description
- Add screenshots
- Set content rating
- Add privacy policy
- Create store listing
- Submit for review

---

## Part 4: Post-Deployment Testing

### Backend API Testing
```bash
# Health check
curl https://your-api.com/health

# Test authentication
curl -X POST https://your-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Test prompts endpoint
curl https://your-api.com/api/prompts/today \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mobile App Testing
- [ ] Download from TestFlight (iOS) or Internal Testing (Android)
- [ ] Test signup flow
- [ ] Test login
- [ ] Test daily prompts
- [ ] Test story creation
- [ ] Test contact sharing
- [ ] Test notifications
- [ ] Test photo/video upload
- [ ] Test all navigation flows

---

## Part 5: Monitoring & Maintenance

### Error Tracking (Recommended)
1. Sign up for [Sentry](https://sentry.io)
2. Add to server.js:
```javascript
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

### Analytics (Optional)
- Google Analytics for web
- Firebase Analytics for mobile
- Mixpanel for user behavior

### Backups
- Supabase provides automatic backups
- Manual backup: `pg_dump -U postgres -h <host> -d postgres > backup.sql`

### Updates
**Server:**
```bash
railway up  # or git push heroku master
```

**Mobile:**
```bash
# OTA update (small changes)
eas update --branch production

# New build (native changes)
eas build --platform all --profile production
```

---

## Part 6: Domain & DNS Setup (Optional)

If you want a custom domain:

1. **Purchase domain** (Namecheap, Google Domains, etc.)
2. **Point to Railway/Heroku:**
   - Add CNAME record: `api.yourdomain.com` → `your-app.railway.app`
3. **Update CORS_ORIGIN** in server .env
4. **Update API_URL** in mobile app

---

## Quick Start Checklist

### Backend (Choose One)
- [ ] Deploy to Railway (easiest)
- [ ] Deploy to Heroku
- [ ] Deploy to DigitalOcean

### Mobile (Both Platforms)
- [ ] Update API_URL in api.js
- [ ] Build iOS with EAS
- [ ] Submit to App Store
- [ ] Build Android with EAS
- [ ] Submit to Google Play

### Final Steps
- [ ] Test production API
- [ ] Test production mobile app
- [ ] Set up error monitoring
- [ ] Configure backups
- [ ] Document any custom configuration

---

## Cost Breakdown

### Monthly Costs
- **Supabase (Database)**: Free tier → $25/month for Pro
- **Railway/Heroku (API Server)**: $5-20/month
- **AWS S3 (File Storage)**: ~$1-5/month
- **Apple Developer**: $99/year
- **Google Play**: $25 one-time
- **Anthropic API**: Usage-based (~$10-50/month depending on AI usage)

**Total**: ~$30-100/month + $99/year Apple fee

---

## Need Help?

Common issues:
1. **Database connection fails**: Check DATABASE_URL in production env
2. **CORS errors**: Update CORS_ORIGIN to match your domain
3. **File uploads fail**: Verify AWS credentials in production
4. **Push notifications not working**: Check firebase-service-account.json uploaded
5. **Build fails**: Check all expo plugins are compatible

---

## What's Your Preference?

Let me know which deployment option you prefer:
1. **Railway** - Easiest, good for startups
2. **Heroku** - Well-established, slightly more expensive
3. **DigitalOcean** - More control, requires more setup
