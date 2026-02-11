# Beta Testing Guide - Forever Stories

## Testing on Your iPhone

### Option 1: Expo Go (Fastest - 2 minutes) ⚡

**Best for:** Quick testing, development

**Steps:**

1. **Install Expo Go on your iPhone**
   - Open App Store
   - Search "Expo Go"
   - Install the app (it's free)

2. **Make sure your iPhone and Mac are on same WiFi**
   - Both connected to same network

3. **Start Expo on your Mac**
   ```bash
   cd /Users/admin/Desktop/forever-stories/expo-mobile
   npx expo start
   ```

4. **On your iPhone:**
   - Open Camera app
   - Point at the QR code in your terminal
   - Tap the notification
   - App opens in Expo Go!

**Pros:**
- ✅ Works instantly
- ✅ No build required
- ✅ Hot reload (changes update live)
- ✅ Free

**Cons:**
- ⚠️ Requires Expo Go app
- ⚠️ Some native features may differ
- ⚠️ Not production build

---

### Option 2: TestFlight (Professional - 30 minutes) 🍎

**Best for:** Real testing, beta testers, production-like experience

**Requirements:**
- Apple Developer Account ($99/year)
- EAS CLI

**Steps:**

1. **Sign up for Apple Developer**
   - https://developer.apple.com/programs/
   - $99/year

2. **Build production app**
   ```bash
   cd /Users/admin/Desktop/forever-stories/expo-mobile

   # Install EAS if not already
   npm install -g eas-cli

   # Login
   eas login

   # Build for TestFlight
   eas build --platform ios --profile preview
   ```

   Build takes ~30 minutes

3. **Submit to TestFlight**
   ```bash
   eas submit --platform ios --latest
   ```

4. **In App Store Connect:**
   - Go to TestFlight tab
   - Add yourself as internal tester
   - Install TestFlight app on iPhone
   - Install your app from TestFlight

**Pros:**
- ✅ Real production build
- ✅ Professional beta testing
- ✅ Can invite up to 10,000 testers
- ✅ Automatic updates

**Cons:**
- ⚠️ Requires $99/year Apple Developer account
- ⚠️ Takes 30 min to build
- ⚠️ More complex setup

---

## Inviting Beta Users

### Option 1: Expo Go Link (Easiest) ⚡

**Best for:** Quick testing with tech-savvy friends

**Steps:**

1. **Get your Expo Go link:**
   ```bash
   cd /Users/admin/Desktop/forever-stories/expo-mobile
   npx expo start --tunnel
   ```

   This creates a public URL like:
   `exp://expo.dev/@username/forever-stories`

2. **Share with beta testers:**
   - Send them the link
   - Tell them to:
     1. Install Expo Go from App Store
     2. Open the link on their phone
     3. App loads in Expo Go

**Pros:**
- ✅ Instant access
- ✅ No app store submission
- ✅ Free
- ✅ Easy updates (just restart server)

**Cons:**
- ⚠️ Requires Expo Go app
- ⚠️ Less professional
- ⚠️ Your Mac must be running the server

---

### Option 2: TestFlight (Professional) 🍎

**Best for:** Serious beta testing with non-technical users

**Requirements:**
- Apple Developer Account ($99/year)
- App built and submitted to TestFlight

**Steps:**

1. **Build and submit to TestFlight** (see Option 2 above)

2. **In App Store Connect:**
   - Go to your app
   - Click "TestFlight" tab
   - Click "+" to add testers

3. **Add External Testers:**
   - Click "External Testers"
   - Create a group (e.g., "Beta Testers")
   - Add email addresses
   - Apple sends them invite emails

4. **Testers receive email:**
   - Link to install TestFlight app
   - Link to install your app
   - They tap and it installs!

**Pros:**
- ✅ Professional experience
- ✅ Real production build
- ✅ Up to 10,000 testers
- ✅ Automatic update notifications
- ✅ Crash reports

**Cons:**
- ⚠️ Requires $99/year
- ⚠️ First external test requires Apple review (1-2 days)
- ⚠️ More setup work

---

### Option 3: Development Build Link (Middle Ground)

**Best for:** Small group of testers, no Apple Developer account yet

**Steps:**

1. **Build a development build:**
   ```bash
   eas build --profile development --platform ios
   ```

2. **Share via EAS:**
   - After build completes, EAS gives you a link
   - Share link with testers
   - They open link on iPhone
   - Install profile and app

**Pros:**
- ✅ No Apple Developer account needed
- ✅ Real build (not Expo Go)
- ✅ Can share with anyone

**Cons:**
- ⚠️ Users must enable developer mode on iPhone
- ⚠️ Not as polished as TestFlight
- ⚠️ Expires after 7-30 days

---

## Recommended Beta Testing Strategy

### Phase 1: Quick Testing (You Only) - TODAY
**Use:** Expo Go on your iPhone
```bash
cd expo-mobile
npx expo start
# Scan QR with Camera app
```

**Test:**
- All features work
- No crashes
- UI looks good
- Performance is acceptable

---

### Phase 2: Friends & Family (5-10 People) - WEEK 1

**Option A: Expo Go (Free, Instant)**
```bash
npx expo start --tunnel
# Share the exp:// link with friends
```

**Option B: TestFlight (Professional)**
1. Sign up for Apple Developer ($99)
2. Build and submit to TestFlight
3. Add friends as external testers

**Get feedback on:**
- Bugs/crashes
- Confusing UI
- Feature requests
- Overall experience

---

### Phase 3: Wider Beta (50-100 People) - WEEK 2-3

**Use:** TestFlight (required at this scale)

1. Build production app
2. Submit to TestFlight
3. Share TestFlight link publicly
4. Gather feedback via:
   - In-app feedback form
   - Google Form
   - Email

---

### Phase 4: Public Launch - WEEK 4+

**Use:** App Store
1. Submit to App Store review
2. Wait 1-3 days for approval
3. Launch!

---

## Quick Start: Test on Your iPhone NOW

**Easiest method (works right now):**

1. **Install Expo Go on your iPhone**
   - App Store → Search "Expo Go" → Install

2. **On your Mac:**
   ```bash
   cd /Users/admin/Desktop/forever-stories/expo-mobile
   npx expo start
   ```

3. **On your iPhone:**
   - Open Camera
   - Point at QR code
   - Tap notification
   - App opens!

**You'll be testing with your PRODUCTION backend!** ✅

---

## Inviting Your First Beta Tester

**Easiest method:**

1. **Start Expo with tunnel:**
   ```bash
   cd /Users/admin/Desktop/forever-stories/expo-mobile
   npx expo start --tunnel
   ```

2. **Copy the exp:// URL from terminal**

3. **Text your friend:**
   ```
   Hey! Want to test my new app?

   1. Install "Expo Go" from App Store
   2. Open this link on your phone: exp://...
   3. Give me feedback!
   ```

**That's it!** They can use your app immediately.

---

## Cost Comparison

| Method | Cost | Setup Time | Best For |
|--------|------|------------|----------|
| Expo Go | Free | 2 min | You, quick testing |
| Dev Build | Free | 30 min | Small group |
| TestFlight | $99/year | 1 hour | Serious beta, public launch |

---

## My Recommendation for You

**Today:** Test on your iPhone with Expo Go (2 minutes)

**This Week:** Decide between:
- **Free route:** Share Expo Go link with 5-10 friends
- **Professional route:** Get Apple Developer + TestFlight

**Next Week:**
- If going free: keep using Expo Go for beta
- If going professional: submit to TestFlight

**Week 4:** Submit to App Store for public launch

---

## Quick Commands Reference

**Test on your iPhone:**
```bash
cd expo-mobile
npx expo start
# Scan QR with Camera
```

**Share with beta testers (Expo Go):**
```bash
cd expo-mobile
npx expo start --tunnel
# Share the exp:// link
```

**Build for TestFlight:**
```bash
eas build --platform ios --profile preview
eas submit --platform ios --latest
```

---

Ready to test on your iPhone? Just install Expo Go and scan the QR code!
