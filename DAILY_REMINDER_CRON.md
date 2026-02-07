# Daily Prompt Reminder Cron Job Setup

This document explains how to set up automated daily prompt reminders that notify users who haven't answered their daily prompt.

## Overview

The system sends push notifications to users who:
- Are owners (have the role 'owner')
- Haven't answered any prompt today
- Have push notifications enabled
- Have daily prompt reminders enabled in their preferences

## Endpoint

**URL:** `POST /api/notifications/send-daily-reminders`

**Authentication:** Requires `X-API-Key` header with the value from `CRON_API_KEY` in `.env`

**When to run:** Daily at 8:00 PM local time (or any evening time you prefer)

## Setup Options

### Option 1: cron-job.org (Easiest - Free)

1. Go to [cron-job.org](https://cron-job.org/)
2. Create a free account
3. Click "Create Cronjob"
4. Configure:
   - **Title:** Forever Stories Daily Reminders
   - **URL:** `https://your-server.com/api/notifications/send-daily-reminders`
   - **Schedule:** Every day at 20:00 (8 PM)
   - **Request Method:** POST
   - **Headers:** Add `X-API-Key: forever-stories-cron-secret-key-abc123xyz`
5. Save and enable

### Option 2: Linux Cron Job

1. On your server, run: `crontab -e`

2. Add this line (runs daily at 8 PM):
```bash
0 20 * * * curl -X POST https://your-server.com/api/notifications/send-daily-reminders -H "X-API-Key: forever-stories-cron-secret-key-abc123xyz"
```

3. Save and exit

### Option 3: Node.js Cron (node-cron package)

If you want to run it within your Node.js app:

1. Install: `npm install node-cron`

2. Add to `server.js`:
```javascript
const cron = require('node-cron');

// Run daily at 8 PM
cron.schedule('0 20 * * *', async () => {
  try {
    console.log('Running daily prompt reminders...');
    await sendDailyPromptReminders(pool);
    console.log('✅ Daily prompt reminders sent');
  } catch (error) {
    console.error('❌ Failed to send daily reminders:', error);
  }
});
```

### Option 4: Cloud Scheduler (AWS CloudWatch Events or Google Cloud Scheduler)

#### AWS CloudWatch Events:
1. Go to AWS CloudWatch → Events → Rules
2. Create rule with schedule expression: `cron(0 20 * * ? *)`
3. Target: Lambda function that calls your API endpoint

#### Google Cloud Scheduler:
1. Go to Cloud Scheduler in Google Cloud Console
2. Create job:
   - **Frequency:** `0 20 * * *`
   - **Target:** HTTP
   - **URL:** Your API endpoint
   - **Headers:** `X-API-Key: forever-stories-cron-secret-key-abc123xyz`

## Testing

Test the endpoint manually:

```bash
curl -X POST http://localhost:3001/api/notifications/send-daily-reminders \
  -H "X-API-Key: forever-stories-cron-secret-key-abc123xyz"
```

Expected response:
```json
{
  "success": true,
  "message": "Daily prompt reminders sent"
}
```

## Customization

### Change the reminder time

Edit the cron schedule:
- `0 20 * * *` = 8:00 PM daily
- `0 18 * * *` = 6:00 PM daily
- `30 19 * * *` = 7:30 PM daily

### Customize notification message

Edit in `pushNotificationService.js`:
```javascript
const notification = {
  title: "⏰ Don't forget today's story!",
  body: "You haven't answered today's prompt yet. Share your memories!",
  // ... customize as needed
};
```

### Add conditions

In `sendDailyPromptReminders()`, you can add additional filters:
- Only send to users with active streaks
- Only send to users who answered yesterday
- Skip users who have answered within the last 3 days
- etc.

## Security

**Important:** Keep your `CRON_API_KEY` secret! Change it from the default value in `.env`:

```bash
CRON_API_KEY=your-unique-secret-key-here-make-it-long-and-random
```

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Monitoring

Check your server logs to see:
- How many users were found who haven't answered
- How many notifications were sent
- Any errors that occurred

The function logs:
```
Found X users who haven't answered today's prompt
```

## Troubleshooting

**No notifications sent:**
- Check that users have `daily_prompt_enabled = true` in `notification_preferences`
- Check that users have `notifications_enabled = true`
- Check that users have active device tokens in `push_tokens` table
- Check server logs for errors

**Wrong time:**
- Cron schedules use UTC time by default
- Adjust the schedule to match your desired local time
- Or use a timezone-aware scheduler

**Notifications not received:**
- Check that APNs key is uploaded to Firebase
- Check that FCM V1 API credentials are correct
- Check device has internet connection
- Check iOS notification settings for the app
