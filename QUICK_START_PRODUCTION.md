# Forever Stories - Quick Start to Production (30 Minutes)

## Option 1: Fastest Path (Railway + EAS)

### Step 1: Deploy Backend to Railway (10 minutes)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy from project directory
cd /Users/admin/Desktop/forever-stories
railway init

# Deploy (this will give you a URL like: https://forever-stories-production.up.railway.app)
railway up

# Set environment variables (Railway will use your current .env for most values)
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(openssl rand -hex 32)
railway variables set CRON_API_KEY=$(openssl rand -hex 16)
```

**Copy the URL Railway gives you** - you'll need it in Step 2.

---

### Step 2: Update Mobile App API URL (2 minutes)
```bash
cd /Users/admin/Desktop/forever-stories/expo-mobile
```

Edit `src/services/api.js` line 3:
```javascript
const API_URL = 'https://your-railway-url.up.railway.app';  // Paste your Railway URL here
```

Edit `src/services/api.js` line 8 - Remove this line:
```javascript
'ngrok-skip-browser-warning': 'true',  // DELETE THIS
```

---

### Step 3: Update app.json (1 minute)
Edit `expo-mobile/app.json` line 44, add `"expo-contacts"` to plugins:
```json
"plugins": [
  "expo-contacts",
  [
    "expo-notifications",
```

---

### Step 4: Test Production Backend (2 minutes)
```bash
# Test health endpoint
curl https://your-railway-url.up.railway.app/health

# Should return: {"status":"healthy",...}
```

---

### Step 5: Install EAS CLI & Login (2 minutes)
```bash
npm install -g eas-cli
eas login
```

Create account at [expo.dev](https://expo.dev) if you don't have one.

---

### Step 6: Configure EAS Build (3 minutes)
```bash
cd /Users/admin/Desktop/forever-stories/expo-mobile
eas build:configure
```

Answer the prompts:
- Generate a new Android Keystore? **Yes**
- Generate a new iOS Distribution Certificate? **Yes**

This creates `eas.json` automatically.

---

### Step 7: Build iOS App (5 minutes + 30 min build time)
```bash
eas build --platform ios --profile production
```

This will:
1. Upload your code to Expo servers
2. Build your app in the cloud (takes ~30 minutes)
3. Give you a URL to download the `.ipa` file when done

You can close terminal and check status at: [expo.dev/builds](https://expo.dev/builds)

---

### Step 8: Build Android App (Optional - can do simultaneously)
```bash
eas build --platform android --profile production
```

---

### Step 9: Submit to App Store (5 minutes)

**Prerequisites:**
- Apple Developer Account ($99/year) - [Sign up here](https://developer.apple.com/programs/)
- Create app in [App Store Connect](https://appstoreconnect.apple.com)

**When iOS build finishes:**
```bash
eas submit --platform ios --latest
```

Fill in required info:
- Apple ID
- App-specific password
- App Store Connect app ID

---

## Option 2: Manual Deployment

### Backend: Heroku
```bash
# Install Heroku CLI
brew install heroku/brew/heroku

# Login
heroku login

# Create app
cd /Users/admin/Desktop/forever-stories
heroku create forever-stories-api

# Deploy
git add .
git commit -m "Prepare for production"
git push heroku master

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
# ... add all other env vars from .env
```

### Mobile: Traditional Build
```bash
# iOS
cd expo-mobile
npx expo prebuild
npx expo run:ios --configuration Release

# Android
npx expo run:android --variant release
```

---

## What You'll Get

After completion:
- ✅ Backend API running at `https://your-app.railway.app`
- ✅ iOS app built and ready for App Store submission
- ✅ Android app built and ready for Google Play submission
- ✅ Production database (Supabase already configured)
- ✅ All features working in production

---

## Costs

**To Launch:**
- Apple Developer: $99/year (required for iOS)
- Google Play: $25 one-time (optional for Android)
- Railway: Free for first project, then $5/month
- Everything else: Free tier (Supabase, AWS S3 has free usage)

**Total first year:** ~$99-124

---

## Timeline

- **Today:** Deploy backend + build apps (1-2 hours)
- **Tomorrow:** Test builds thoroughly
- **Day 3-4:** Prepare App Store listing (screenshots, description)
- **Day 5:** Submit to Apple App Store
- **Day 7-14:** Wait for Apple review
- **Day 15:** Launch! 🎉

---

## Quick Checklist

- [ ] Deploy backend to Railway
- [ ] Copy Railway URL
- [ ] Update API_URL in mobile app
- [ ] Remove ngrok header
- [ ] Add expo-contacts to plugins
- [ ] Test production API
- [ ] Run `eas build:configure`
- [ ] Run `eas build --platform ios`
- [ ] Sign up for Apple Developer
- [ ] Submit to App Store with `eas submit`

---

## Need Help?

**Common Issues:**

**"Railway deploy failed"**
- Check package.json has start script: `"start": "node server.js"`
- Verify all dependencies are in package.json

**"EAS build failed"**
- Run `eas build:configure` again
- Check expo-contacts is in app.json plugins
- Verify all assets exist (icon.png, splash-icon.png)

**"Can't connect to API"**
- Verify Railway app is running: `railway status`
- Check CORS settings include your domain
- Test health endpoint: `curl https://your-app.railway.app/health`

---

## Ready to Start?

Run this command to begin:
```bash
npm i -g @railway/cli eas-cli && railway login && eas login
```

Then follow Steps 1-9 above!
