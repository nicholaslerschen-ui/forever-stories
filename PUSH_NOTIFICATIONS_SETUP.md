# Push Notifications Setup Guide

## Firebase Project Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Name it "Forever Stories" (or use existing)
4. Disable Google Analytics (optional for this use case)
5. Click "Create project"

### 2. Add iOS App to Firebase

1. In Firebase Console, click the iOS icon
2. **iOS bundle ID**: `org.reactjs.native.example.ForeverStoriesMobile` (check in Xcode)
3. **App nickname**: Forever Stories iOS
4. Leave App Store ID blank (not published yet)
5. Click "Register app"
6. **Download `GoogleService-Info.plist`**
7. **Important**: Move the downloaded file to:
   ```
   /Users/admin/Desktop/forever-stories/mobile/ios/GoogleService-Info.plist
   ```
8. Open Xcode project at `mobile/ios/ForeverStoriesMobile.xcworkspace`
9. Drag `GoogleService-Info.plist` into the project (make sure "Copy items if needed" is checked)
10. Continue through the setup wizard (SDK is already installed via npm)

### 3. Add Android App to Firebase

1. In Firebase Console, click the Android icon
2. **Android package name**: `com.foreverstoriesmobile` (check in `android/app/build.gradle`)
3. **App nickname**: Forever Stories Android
4. Leave signing certificate blank for now
5. Click "Register app"
6. **Download `google-services.json`**
7. **Important**: Move the downloaded file to:
   ```
   /Users/admin/Desktop/forever-stories/mobile/android/app/google-services.json
   ```
8. Continue through setup wizard

### 4. Enable Cloud Messaging

1. In Firebase Console, go to "Project settings" → "Cloud Messaging"
2. **Important**: Copy the "Server key" - you'll need this for the backend

### 5. iOS: Enable Push Notifications Capability

1. Open Xcode project at `mobile/ios/ForeverStoriesMobile.xcworkspace`
2. Select the project in the navigator
3. Select the "ForeverStoriesMobile" target
4. Go to "Signing & Capabilities" tab
5. Click "+ Capability"
6. Add "Push Notifications"
7. Add "Background Modes"
   - Check "Remote notifications"

### 6. iOS: Configure APNs Authentication

#### Option A: APNs Authentication Key (Recommended)

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
2. Click "+" to create a new key
3. Name it "Forever Stories Push"
4. Check "Apple Push Notifications service (APNs)"
5. Click "Continue" and "Register"
6. **Download the .p8 file** (you can only download once!)
7. Note the Key ID
8. In Firebase Console, go to "Project settings" → "Cloud Messaging" → "iOS app configuration"
9. Upload the .p8 file
10. Enter your Key ID and Team ID

#### Option B: APNs Certificates (Legacy)

1. Go to Firebase Console → "Project settings" → "Cloud Messaging" → "iOS app configuration"
2. Follow instructions to create APNs certificate
3. Upload to Firebase

### 7. Update Backend Environment Variables

Add to your `.env` file:

```bash
# Firebase Cloud Messaging
FCM_SERVER_KEY=your-firebase-server-key-from-step-4
FIREBASE_PROJECT_ID=your-firebase-project-id
```

## Backend Configuration

The backend will need the FCM server key to send push notifications. This is configured in `server.js`.

## Testing Push Notifications

### Test on iOS Simulator (Note: Push notifications don't work on simulator)
For development, you'll need a real iOS device.

### Test on Android Emulator
Android emulator supports push notifications.

### Test Flow

1. **Register device token**:
   - Launch app on device
   - Allow notifications when prompted
   - Token will be automatically registered with backend

2. **Send test notification**:
   ```bash
   curl -X POST http://localhost:3001/api/notifications/test \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"title": "Test", "body": "Hello from Forever Stories!"}'
   ```

3. **Verify in logs**:
   - Check mobile app logs for token registration
   - Check backend logs for notification sending
   - Check `notification_log` table in database

## Notification Types Implemented

1. **Daily Prompt Reminder** - "Your daily prompt is ready! ✨"
2. **New Family Question** - "❤️ [Name] asked you a question"
3. **Response Received** - "✅ [Owner] answered your question" (for viewers)
4. **Streak Reminder** - "🔥 Don't break your streak! Answer today's prompt"

## Troubleshooting

### iOS: Token not generating
- Check that push capability is enabled in Xcode
- Check that APNs auth is configured in Firebase
- Check device Settings → Notifications → Forever Stories

### Android: Token not generating
- Check that `google-services.json` is in correct location
- Check that Firebase is initialized
- Run `cd android && ./gradlew clean && cd ..`

### Notifications not received
- Check notification_log table for delivery status
- Check FCM_SERVER_KEY is correct in .env
- Check user has notifications enabled in notification_preferences table
- Check device has internet connection

### iOS: App crashes on launch
- Check that GoogleService-Info.plist is added to Xcode project
- Check that pod install was run: `cd ios && pod install && cd ..`

## Files Created

- `mobile/src/services/PushNotificationService.js` - Main service for handling notifications
- `mobile/src/hooks/usePushNotifications.js` - React hook for using notifications
- `server-push-notifications.js` - Backend notification sending logic
- `migrations/007-push-notifications.sql` - Database schema
