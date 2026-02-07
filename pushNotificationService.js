// pushNotificationService.js - Firebase Cloud Messaging (FCM) service for sending push notifications

const { GoogleAuth } = require('google-auth-library');
const https = require('https');
require('dotenv').config();

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// Initialize Google Auth for FCM V1 API
const auth = new GoogleAuth({
  keyFile: GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
});

const FCM_V1_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

/**
 * Send push notification via Firebase Cloud Messaging V1 API
 * @param {string} deviceToken - FCM device token
 * @param {object} notification - {title, body, data}
 * @returns {Promise<boolean>} - Success status
 */
async function sendFCMNotification(deviceToken, notification) {
  if (!GOOGLE_APPLICATION_CREDENTIALS || !FIREBASE_PROJECT_ID) {
    console.warn('⚠️ Firebase credentials not configured. Skipping notification send.');
    return false;
  }

  try {
    // Get access token from service account
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      console.error('❌ Failed to get access token');
      return false;
    }

    // FCM V1 API payload format
    const payload = JSON.stringify({
      message: {
        token: deviceToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'content-available': 1
            }
          }
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default'
          }
        }
      }
    });

    const url = new URL(FCM_V1_ENDPOINT);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 200) {
              console.log('✅ FCM notification sent successfully:', response.name);
              resolve(true);
            } else {
              console.error('❌ FCM notification failed:', res.statusCode, response);
              resolve(false);
            }
          } catch (error) {
            console.error('Error parsing FCM response:', error);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('FCM request error:', error);
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    return false;
  }
}

/**
 * Send push notification to multiple devices
 * @param {Array<string>} deviceTokens - Array of FCM device tokens
 * @param {object} notification - {title, body, data}
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function sendBulkNotifications(deviceTokens, notification) {
  const results = await Promise.allSettled(
    deviceTokens.map(token => sendFCMNotification(token, notification))
  );

  const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - sent;

  console.log(`📊 Bulk notification results: ${sent} sent, ${failed} failed`);

  return { sent, failed };
}

/**
 * Send daily prompt reminder to user
 * @param {object} pool - PostgreSQL pool
 * @param {string} userId - User ID
 * @param {string} promptText - Prompt text preview
 */
async function sendDailyPromptNotification(pool, userId, promptText = '') {
  try {
    // Get user's active device tokens
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for user ${userId}`);
      return;
    }

    // Check notification preferences
    const prefsResult = await pool.query(
      `SELECT daily_prompt_enabled, notifications_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs || !prefs.notifications_enabled || !prefs.daily_prompt_enabled) {
      console.log(`Daily prompt notifications disabled for user ${userId}`);
      return;
    }

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    const notification = {
      title: "Your daily prompt is ready! ✨",
      body: promptText ? promptText.substring(0, 100) : "Share your story today",
      data: {
        type: 'daily_prompt',
        userId: userId
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

    // Log notification
    await pool.query(
      `INSERT INTO notification_log (user_id, notification_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'daily_prompt', notification.title, notification.body, JSON.stringify(notification.data)]
    );

  } catch (error) {
    console.error('Error sending daily prompt notification:', error);
  }
}

/**
 * Send notification about new family question
 * @param {object} pool - PostgreSQL pool
 * @param {string} ownerId - Story owner user ID
 * @param {string} submitterName - Name of person who submitted question
 * @param {string} questionId - Question ID
 */
async function sendFamilyQuestionNotification(pool, ownerId, submitterName, questionId) {
  try {
    // Get owner's active device tokens
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [ownerId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for owner ${ownerId}`);
      return;
    }

    // Check notification preferences
    const prefsResult = await pool.query(
      `SELECT family_questions_enabled, notifications_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [ownerId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs || !prefs.notifications_enabled || !prefs.family_questions_enabled) {
      console.log(`Family question notifications disabled for owner ${ownerId}`);
      return;
    }

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    const notification = {
      title: "❤️ New question from your family",
      body: `${submitterName} asked you a question`,
      data: {
        type: 'family_question',
        questionId: questionId,
        ownerId: ownerId
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

    // Log notification
    await pool.query(
      `INSERT INTO notification_log (user_id, notification_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [ownerId, 'family_question', notification.title, notification.body, JSON.stringify(notification.data)]
    );

  } catch (error) {
    console.error('Error sending family question notification:', error);
  }
}

/**
 * Send notification to viewer when owner answers their question
 * @param {object} pool - PostgreSQL pool
 * @param {string} viewerId - Viewer user ID
 * @param {string} ownerName - Owner's name
 * @param {string} responseId - Response ID
 */
async function sendResponseReceivedNotification(pool, viewerId, ownerName, responseId) {
  try {
    // Get viewer's active device tokens
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [viewerId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for viewer ${viewerId}`);
      return;
    }

    // Check notification preferences
    const prefsResult = await pool.query(
      `SELECT responses_received_enabled, notifications_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [viewerId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs || !prefs.notifications_enabled || !prefs.responses_received_enabled) {
      console.log(`Response notifications disabled for viewer ${viewerId}`);
      return;
    }

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    const notification = {
      title: "✅ New story from " + ownerName,
      body: `${ownerName} answered your question!`,
      data: {
        type: 'response_received',
        responseId: responseId,
        viewerId: viewerId
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

    // Log notification
    await pool.query(
      `INSERT INTO notification_log (user_id, notification_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [viewerId, 'response_received', notification.title, notification.body, JSON.stringify(notification.data)]
    );

  } catch (error) {
    console.error('Error sending response received notification:', error);
  }
}

/**
 * Send streak reminder notification
 * @param {object} pool - PostgreSQL pool
 * @param {string} userId - User ID
 * @param {number} streakDays - Current streak days
 */
async function sendStreakReminderNotification(pool, userId, streakDays) {
  try {
    // Get user's active device tokens
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      return;
    }

    // Check notification preferences
    const prefsResult = await pool.query(
      `SELECT streak_reminders_enabled, notifications_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs || !prefs.notifications_enabled || !prefs.streak_reminders_enabled) {
      return;
    }

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    const notification = {
      title: `🔥 ${streakDays} day streak!`,
      body: "Don't break your streak! Answer today's prompt",
      data: {
        type: 'streak_reminder',
        userId: userId,
        streakDays: streakDays.toString()
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

    // Log notification
    await pool.query(
      `INSERT INTO notification_log (user_id, notification_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'streak_reminder', notification.title, notification.body, JSON.stringify(notification.data)]
    );

  } catch (error) {
    console.error('Error sending streak reminder notification:', error);
  }
}

/**
 * Send notification when user is invited to view stories
 * @param {object} pool - PostgreSQL pool
 * @param {string} viewerEmail - Viewer's email address
 * @param {string} ownerName - Owner's name who sent the invite
 * @param {string} inviteCode - Invite code
 * @param {boolean} isReverseInvite - True if viewer is inviting owner (reverse invite)
 */
async function sendInviteNotification(pool, viewerEmail, ownerName, inviteCode, isReverseInvite = false) {
  try {
    // Find viewer user by email
    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [viewerEmail]
    );

    if (userResult.rows.length === 0) {
      console.log(`No user found for email ${viewerEmail} - they'll get notification when they sign up`);
      return;
    }

    const viewerId = userResult.rows[0].id;

    // Get viewer's active device tokens
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [viewerId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for viewer ${viewerId}`);
      return;
    }

    // Check notification preferences
    const prefsResult = await pool.query(
      `SELECT invites_enabled, notifications_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [viewerId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs || !prefs.notifications_enabled) {
      console.log(`Invite notifications disabled for viewer ${viewerId}`);
      return;
    }

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    // Different message for reverse invites (viewer → owner)
    const notification = isReverseInvite ? {
      title: "🎉 You've been invited!",
      body: `${ownerName} wants to hear your life stories`,
      data: {
        type: 'invite_received',
        inviteCode: inviteCode,
        ownerName: ownerName,
        isReverseInvite: 'true'
      }
    } : {
      title: "🎉 You've been invited!",
      body: `${ownerName} invited you to view their life stories`,
      data: {
        type: 'invite_received',
        inviteCode: inviteCode,
        ownerName: ownerName
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

    // Log notification
    await pool.query(
      `INSERT INTO notification_log (user_id, notification_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [viewerId, 'invite_received', notification.title, notification.body, JSON.stringify(notification.data)]
    );

  } catch (error) {
    console.error('Error sending invite notification:', error);
  }
}

/**
 * Send reminder to users who haven't answered today's prompt
 * This should be called by a scheduled job (e.g., cron) in the evening
 * Combines daily reminder + streak reminder into one notification
 * @param {object} pool - PostgreSQL pool
 */
async function sendDailyPromptReminders(pool) {
  try {
    // Find all owner users who haven't answered today's prompt, with their streak info
    const today = new Date().toISOString().split('T')[0];

    const usersResult = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.current_streak
       FROM users u
       WHERE u.role = 'owner'
       AND u.id NOT IN (
         SELECT user_id
         FROM prompt_responses
         WHERE DATE(created_at) = $1
       )`,
      [today]
    );

    console.log(`Found ${usersResult.rows.length} users who haven't answered today's prompt`);

    for (const user of usersResult.rows) {
      await sendDailyPromptReminderNotification(pool, user.id, user.full_name, user.current_streak || 0);
    }

  } catch (error) {
    console.error('Error sending daily prompt reminders:', error);
  }
}

/**
 * Send reminder notification to a specific user about today's prompt
 * Implements cooldown logic: after 3 consecutive skips, wait 7 days, then send final reminder
 * @param {object} pool - PostgreSQL pool
 * @param {string} userId - User ID
 * @param {string} userName - User's name
 * @param {number} streak - Current streak days
 */
async function sendDailyPromptReminderNotification(pool, userId, userName, streak) {
  try {
    // Get user's active device tokens
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      return;
    }

    // Check notification preferences including cooldown fields
    const prefsResult = await pool.query(
      `SELECT daily_prompt_enabled, notifications_enabled, consecutive_skips,
              in_cooldown, cooldown_until, final_reminder_sent, last_reminder_sent_at
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs || !prefs.notifications_enabled || !prefs.daily_prompt_enabled) {
      return;
    }

    const now = new Date();

    // Check if user is in cooldown period
    if (prefs.in_cooldown) {
      const cooldownUntil = new Date(prefs.cooldown_until);

      // If cooldown period is over and final reminder hasn't been sent yet
      if (now >= cooldownUntil && !prefs.final_reminder_sent) {
        // Send final "we miss you" reminder
        const deviceTokens = tokensResult.rows.map(r => r.device_token);

        const notification = {
          title: "💙 We miss your stories",
          body: "It's been a while! Your memories are precious. Share one today?",
          data: {
            type: 'final_reminder',
            userId: userId
          }
        };

        await sendBulkNotifications(deviceTokens, notification);

        // Mark final reminder as sent
        await pool.query(
          `UPDATE notification_preferences
           SET final_reminder_sent = TRUE, last_reminder_sent_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );

        // Log notification
        await pool.query(
          `INSERT INTO notification_log (user_id, notification_type, title, body, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'final_reminder', notification.title, notification.body, JSON.stringify(notification.data)]
        );

        console.log(`Sent final reminder to user ${userId} after cooldown`);
      }

      // Don't send regular reminders if in cooldown
      return;
    }

    // If final reminder was already sent, don't send any more notifications
    if (prefs.final_reminder_sent) {
      return;
    }

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    // Choose notification based on streak
    let notification;
    if (streak >= 5) {
      notification = {
        title: `🔥 Keep your ${streak} day streak alive!`,
        body: "Don't break your streak! Answer today's prompt",
        data: {
          type: 'daily_reminder',
          userId: userId,
          streak: streak.toString()
        }
      };
    } else {
      notification = {
        title: "📖 Your daily story awaits",
        body: "Take a moment to answer today's prompt and preserve your memories",
        data: {
          type: 'daily_reminder',
          userId: userId
        }
      };
    }

    await sendBulkNotifications(deviceTokens, notification);

    // Increment consecutive skips
    const newConsecutiveSkips = (prefs.consecutive_skips || 0) + 1;

    // If user has skipped 3 times in a row, enter cooldown period
    if (newConsecutiveSkips >= 3) {
      const cooldownUntil = new Date();
      cooldownUntil.setDate(cooldownUntil.getDate() + 7); // 7 days from now

      await pool.query(
        `UPDATE notification_preferences
         SET consecutive_skips = $1,
             in_cooldown = TRUE,
             cooldown_until = $2,
             last_reminder_sent_at = NOW()
         WHERE user_id = $3`,
        [newConsecutiveSkips, cooldownUntil, userId]
      );

      console.log(`User ${userId} entered cooldown after 3 consecutive skips. Cooldown until ${cooldownUntil.toISOString()}`);
    } else {
      // Just increment consecutive skips
      await pool.query(
        `UPDATE notification_preferences
         SET consecutive_skips = $1, last_reminder_sent_at = NOW()
         WHERE user_id = $2`,
        [newConsecutiveSkips, userId]
      );
    }

    // Log notification
    await pool.query(
      `INSERT INTO notification_log (user_id, notification_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'daily_reminder', notification.title, notification.body, JSON.stringify(notification.data)]
    );

  } catch (error) {
    console.error('Error sending daily prompt reminder notification:', error);
  }
}

/**
 * Reset notification cooldown when user submits a response
 * Call this whenever a user successfully submits a prompt response
 * @param {object} pool - PostgreSQL pool
 * @param {string} userId - User ID
 */
async function resetNotificationCooldown(pool, userId) {
  try {
    await pool.query(
      `UPDATE notification_preferences
       SET consecutive_skips = 0,
           in_cooldown = FALSE,
           cooldown_until = NULL,
           final_reminder_sent = FALSE
       WHERE user_id = $1`,
      [userId]
    );
    console.log(`Reset notification cooldown for user ${userId}`);
  } catch (error) {
    console.error('Error resetting notification cooldown:', error);
  }
}

module.exports = {
  sendFCMNotification,
  sendBulkNotifications,
  sendDailyPromptNotification,
  sendFamilyQuestionNotification,
  sendResponseReceivedNotification,
  sendStreakReminderNotification,
  sendInviteNotification,
  sendDailyPromptReminders,
  sendDailyPromptReminderNotification,
  resetNotificationCooldown
};
