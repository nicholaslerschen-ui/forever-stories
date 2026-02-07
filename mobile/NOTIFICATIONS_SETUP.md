# Daily Notifications Setup Guide

## Overview
Daily prompt notifications have been implemented using `expo-notifications`. This allows users to receive reminders at their chosen time each day.

## Features Implemented
- ✅ Enable/disable daily reminders via Settings screen
- ✅ Choose notification time from 9 preset options (7 AM - 9 PM)
- ✅ Notification tap opens the Daily Prompt screen
- ✅ Settings persist across app restarts using AsyncStorage
- ✅ Native notification permission requests

## Files Modified/Created

### New Files:
- `/mobile/src/services/notifications.js` - Notification service handling all notification logic
- `/mobile/NOTIFICATIONS_SETUP.md` - This file

### Modified Files:
- `/mobile/src/screens/SettingsScreen.js` - Added notification controls
- `/mobile/src/navigation/AppNavigator.js` - Added notification response handler
- `/mobile/package.json` - Added expo-notifications dependency

## iOS Setup (Required)

Since this is a bare React Native app (not Expo Go), the native module needs to be linked:

### 1. Install iOS Dependencies
```bash
cd ios
pod install
cd ..
```

### 2. Add Notification Permissions to Info.plist
The app may request notification permissions at runtime, but for best practice, add this to `ios/ForeverStoriesMobile/Info.plist` before the closing `</dict>`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

### 3. Rebuild the iOS App
```bash
npm run ios
```

Or open in Xcode and rebuild:
```bash
open ios/ForeverStoriesMobile.xcworkspace
```

## Testing

1. **Enable Notifications:**
   - Login → Dashboard → Account Settings → App Settings
   - Toggle "Enable Reminders" switch
   - App will request notification permissions
   - Select a reminder time (e.g., "9:00 AM")

2. **Verify Scheduled:**
   - Notifications are scheduled to repeat daily
   - Check iOS Settings → Notifications → ForeverStoriesMobile to verify permissions

3. **Test Notification:**
   - To test without waiting, modify the time in `notifications.js` scheduleDailyReminder to trigger in 1 minute
   - Or use a time that's coming up soon

4. **Test Tap Behavior:**
   - When notification appears, tap it
   - App should open to the DailyPrompt screen

## How It Works

### Notification Service (`notifications.js`)
```javascript
- requestPermissions() - Requests iOS/Android notification permissions
- scheduleDailyReminder(hour, minute) - Schedules a repeating daily notification
- cancelAllNotifications() - Cancels all scheduled notifications
- getNotificationSettings() - Loads saved settings from AsyncStorage
- saveNotificationSettings(settings) - Persists settings
```

### Settings Screen
- Toggle switch enables/disables notifications
- When enabled, shows time selector with 9 preset times
- Changes take effect immediately
- All settings saved to AsyncStorage

### Navigation Handler
- Listens for notification taps in `AppNavigator.js`
- Navigates to DailyPrompt screen when notification is tapped
- Works when app is in foreground, background, or killed

## Configuration

Default notification settings:
```javascript
{
  enabled: false,
  time: '09:00' // 9:00 AM
}
```

Time options available:
- 7:00 AM, 8:00 AM, 9:00 AM, 10:00 AM
- 12:00 PM, 2:00 PM
- 5:00 PM, 7:00 PM, 9:00 PM

## Future Enhancements

Potential improvements:
- Custom time picker (instead of preset times)
- Smart notifications (only if user hasn't completed daily prompt)
- Different notification messages based on day of week
- Notification history/logs
- Multiple daily reminders option
- Timezone-aware scheduling

## Troubleshooting

### Notifications not appearing:
1. Check iOS Settings → Notifications → ForeverStoriesMobile → Allow Notifications is ON
2. Verify notification was scheduled: check `getScheduledNotifications()` in service
3. Ensure time is in the future (not past for today)
4. Rebuild the app if you just installed expo-notifications

### Permission denied:
1. Go to iOS Settings → ForeverStoriesMobile → Notifications
2. Enable "Allow Notifications"
3. Return to app and toggle notifications again

### Notification doesn't navigate:
1. Check that NavigationContainer has proper ref in AppNavigator
2. Ensure notification response listener is set up
3. Verify notification data includes `type: 'daily_reminder'`

## Notes

- Notifications use local scheduling (not push notifications)
- No server-side setup required
- Works offline
- Respects iOS "Do Not Disturb" settings
- On iOS simulator, notifications may not display visually but will still trigger in logs
