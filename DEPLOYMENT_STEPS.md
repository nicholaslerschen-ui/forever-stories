# Deployment Steps - Quick Reference

## Backend Deployment (Railway)

### 1. Login to Railway ✅ (You're doing this now)
```bash
railway login
```

### 2. Initialize Railway Project
```bash
cd /Users/admin/Desktop/forever-stories
railway init
```
- Choose "Create new project"
- Name it "forever-stories-api" (or whatever you like)

### 3. Deploy
```bash
railway up
```
This will:
- Upload your code
- Install dependencies
- Start the server
- Give you a URL like: `https://forever-stories-production.up.railway.app`

### 4. Set Environment Variables
```bash
# Copy all from .env to Railway
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=$(openssl rand -hex 32)
railway variables set CRON_API_KEY=$(openssl rand -hex 16)

# Railway will automatically use your current .env for most values
```

### 5. Get Your Production URL
```bash
railway domain
```

### 6. Test It
```bash
curl https://your-railway-url.up.railway.app/health
```

Should return: `{"status":"healthy",...}`

---

## Mobile App Updates

### 1. Update API URL
Edit `expo-mobile/src/services/api.js` line 3:
```javascript
const API_URL = 'https://your-railway-url.up.railway.app';
```

### 2. Remove Development Headers
Edit `expo-mobile/src/services/api.js` line 8:
Remove: `'ngrok-skip-browser-warning': 'true',`

### 3. Test Locally
```bash
cd expo-mobile
npx expo start
```

Test that login/signup/prompts work with production backend.

---

## Next Steps (Can Do Later)

### Build for App Stores
```bash
cd expo-mobile
eas build:configure
eas build --platform ios
eas build --platform android
```

### Submit to Stores
```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

---

**Current Status:**
- [x] Railway CLI installed
- [ ] Railway login (you're doing this now)
- [ ] Railway project initialized
- [ ] Backend deployed
- [ ] Mobile app updated
- [ ] Production tested

Come back when you've logged into Railway!
