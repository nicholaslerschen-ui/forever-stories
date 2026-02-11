# Weekly Viewer Reminder Cron Job Setup

This document explains how to set up automated weekly reminders for viewers to ask questions to their family/friends.

## Overview

The system sends push notifications to viewers who:
- Are viewers (have the role 'viewer')
- Have access to at least one owner's stories
- Haven't submitted a question in the last 7 days
- Have push notifications enabled
- Have viewer reminders enabled in their preferences

## Endpoint

**URL:** `POST /api/notifications/send-weekly-viewer-reminders`

**Authentication:** Requires `X-API-Key` header with the value from `CRON_API_KEY` in `.env`

**When to run:** Weekly on Sundays at 10:00 AM (or any time you prefer)

## Setup Options

### Option 1: cron-job.org (Easiest - Free)

1. Go to [cron-job.org](https://cron-job.org/)
2. Create a free account
3. Click "Create Cronjob"
4. Configure:
   - **Title:** Forever Stories Weekly Viewer Reminders
   - **URL:** `https://your-server.com/api/notifications/send-weekly-viewer-reminders`
   - **Schedule:** Every Sunday at 10:00 AM (weekly)
   - **Request Method:** POST
   - **Headers:** Add `X-API-Key: forever-stories-cron-secret-key-abc123xyz`
5. Save and enable

### Option 2: Linux Cron Job

1. On your server, run: `crontab -e`

2. Add this line (runs every Sunday at 10 AM):
```bash
0 10 * * 0 curl -X POST https://your-server.com/api/notifications/send-weekly-viewer-reminders -H "X-API-Key: forever-stories-cron-secret-key-abc123xyz"
```

3. Save and exit

### Option 3: Node.js Cron (node-cron package)

If you want to run it within your Node.js app:

1. Install: `npm install node-cron`

2. Add to `server.js`:
```javascript
const cron = require('node-cron');

// Run every Sunday at 10 AM
cron.schedule('0 10 * * 0', async () => {
  try {
    console.log('Running weekly viewer reminders...');
    await sendWeeklyViewerReminders(pool);
    console.log('✅ Weekly viewer reminders sent');
  } catch (error) {
    console.error('❌ Failed to send weekly viewer reminders:', error);
  }
});
```

### Option 4: Cloud Scheduler (AWS CloudWatch Events or Google Cloud Scheduler)

#### AWS CloudWatch Events:
1. Go to AWS CloudWatch → Events → Rules
2. Create rule with schedule expression: `cron(0 10 ? * 1 *)`  (Every Sunday at 10 AM)
3. Target: Lambda function that calls your API endpoint

#### Google Cloud Scheduler:
1. Go to Cloud Scheduler in Google Cloud Console
2. Create job:
   - **Frequency:** `0 10 * * 0`  (Every Sunday at 10 AM)
   - **Target:** HTTP
   - **URL:** Your API endpoint
   - **Headers:** `X-API-Key: forever-stories-cron-secret-key-abc123xyz`

## Testing

Test the endpoint manually:

```bash
curl -X POST http://localhost:3001/api/notifications/send-weekly-viewer-reminders \
  -H "X-API-Key: forever-stories-cron-secret-key-abc123xyz"
```

Expected response:
```json
{
  "success": true,
  "message": "Weekly viewer reminders sent"
}
```

## Customization

### Change the reminder day/time

Edit the cron schedule:
- `0 10 * * 0` = Sunday at 10:00 AM
- `0 10 * * 1` = Monday at 10:00 AM
- `0 14 * * 0` = Sunday at 2:00 PM
- `0 10 * * 3` = Wednesday at 10:00 AM

### Customize notification message

Edit in `pushNotificationService.js` in the `sendViewerReminderNotification` function:
```javascript
const notification = {
  title: "💭 Ask a question",
  body: `What would you like to know about ${ownerText}? Submit a question for them to answer!`,
  // ... customize as needed
};
```

### Add conditions

In `sendWeeklyViewerReminders()`, you can add additional filters:
- Only send to viewers who have read stories in the last month
- Skip viewers who submitted questions within the last 14 days (instead of 7)
- Only send to viewers with active access grants
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
- How many viewers were found who haven't submitted questions
- How many notifications were sent
- Any errors that occurred

The function logs:
```
Found X viewers who haven't submitted questions recently
Sent weekly reminder to viewer <id> (<name>)
```

## Troubleshooting

**No notifications sent:**
- Check that viewers have `viewer_reminders_enabled = true` in `notification_preferences`
- Check that viewers have `notifications_enabled = true`
- Check that viewers have active device tokens in `push_tokens` table
- Check that viewers have active access grants in `access_grants` table
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

## Database Migration

Before running the cron job, ensure the database migration has been applied:

```bash
psql -U your_username -d forever_stories < migrations/010-viewer-reminders.sql
```

This adds the `viewer_reminders_enabled` column to the `notification_preferences` table.

## Notification Preferences

Viewers can control whether they receive these reminders in their notification settings:
- The default is **enabled** (TRUE)
- Viewers can opt out by setting `viewer_reminders_enabled = false` in their preferences
- The mobile app should include a toggle in Settings for "Weekly Question Reminders"
