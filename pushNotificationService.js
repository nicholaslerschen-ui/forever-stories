// pushNotificationService.js - Expo Push Notification service for sending push notifications

const { Expo } = require('expo-server-sdk');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Send push notification via Expo Push API
 * @param {string} pushToken - Expo push token (ExponentPushToken[...])
 * @param {object} notification - {title, body, data}
 * @returns {Promise<boolean>} - Success status
 */
async function sendPushNotification(pushToken, notification) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`⚠️ Invalid Expo push token: ${pushToken}`);
    return false;
  }

  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
    };

    const chunks = expo.chunkPushNotifications([message]);

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of ticketChunk) {
        if (ticket.status === 'ok') {
          console.log('✅ Push notification sent successfully');
          return true;
        } else if (ticket.status === 'error') {
          console.error(`❌ Push notification error: ${ticket.message}`);
          if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
            console.log('Device not registered - token should be removed');
          }
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * Send push notification to multiple devices
 * @param {Array<string>} pushTokens - Array of Expo push tokens
 * @param {object} notification - {title, body, data}
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function sendBulkNotifications(pushTokens, notification) {
  // Filter to only valid Expo push tokens
  const validTokens = pushTokens.filter(token => Expo.isExpoPushToken(token));
  const invalidCount = pushTokens.length - validTokens.length;

  if (invalidCount > 0) {
    console.warn(`⚠️ Skipped ${invalidCount} invalid push tokens`);
  }

  if (validTokens.length === 0) {
    console.log('No valid push tokens to send to');
    return { sent: 0, failed: pushTokens.length };
  }

  const messages = validTokens.map(token => ({
    to: token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of ticketChunk) {
        if (ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          if (ticket.details && ticket.details.error) {
            console.error(`Push error: ${ticket.details.error} - ${ticket.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Error sending chunk:', error);
      failed += chunk.length;
    }
  }

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
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for user ${userId}`);
      return;
    }

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
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [ownerId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for owner ${ownerId}`);
      return;
    }

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
      title: "New question from your family",
      body: `${submitterName} asked you a question`,
      data: {
        type: 'family_question',
        questionId: questionId,
        ownerId: ownerId
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

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
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [viewerId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for viewer ${viewerId}`);
      return;
    }

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
      title: "New story from " + ownerName,
      body: `${ownerName} answered your question!`,
      data: {
        type: 'response_received',
        responseId: responseId,
        viewerId: viewerId
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

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
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      return;
    }

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
      title: `${streakDays} day streak!`,
      body: "Don't break your streak! Answer today's prompt",
      data: {
        type: 'streak_reminder',
        userId: userId,
        streakDays: streakDays.toString()
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

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
    const userResult = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [viewerEmail]
    );

    if (userResult.rows.length === 0) {
      console.log(`No user found for email ${viewerEmail} - they'll get notification when they sign up`);
      return;
    }

    const viewerId = userResult.rows[0].id;

    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [viewerId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`No active tokens for viewer ${viewerId}`);
      return;
    }

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

    const notification = isReverseInvite ? {
      title: "You've been invited!",
      body: `${ownerName} wants to hear your life stories`,
      data: {
        type: 'invite_received',
        inviteCode: inviteCode,
        ownerName: ownerName,
        isReverseInvite: 'true'
      }
    } : {
      title: "You've been invited!",
      body: `${ownerName} invited you to view their life stories`,
      data: {
        type: 'invite_received',
        inviteCode: inviteCode,
        ownerName: ownerName
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

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
 * @param {object} pool - PostgreSQL pool
 */
async function sendDailyPromptReminders(pool) {
  try {
    // Use Phoenix timezone to match the cron schedule
    const phoenixDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });
    console.log(`📅 Checking for daily prompt reminders (Phoenix date: ${phoenixDate})`);

    // Find owners who haven't answered today (in Phoenix timezone)
    const usersResult = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.current_streak
       FROM users u
       WHERE u.role = 'owner'
       AND u.id NOT IN (
         SELECT user_id
         FROM prompt_responses
         WHERE DATE(created_at AT TIME ZONE 'America/Phoenix') = $1
       )`,
      [phoenixDate]
    );

    console.log(`Found ${usersResult.rows.length} users who haven't answered today's prompt`);

    // Check which users have push tokens registered
    const usersWithTokens = [];
    for (const user of usersResult.rows) {
      const tokenCheck = await pool.query(
        'SELECT COUNT(*) FROM push_tokens WHERE user_id = $1 AND is_active = TRUE',
        [user.id]
      );
      if (parseInt(tokenCheck.rows[0].count) > 0) {
        usersWithTokens.push(user);
      }
    }
    console.log(`Of those, ${usersWithTokens.length} have active push tokens`);

    for (const user of usersWithTokens) {
      // Ensure notification preferences exist before sending
      await pool.query(
        'INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
        [user.id]
      );

      await sendDailyPromptReminderNotification(pool, user.id, user.full_name, user.current_streak || 0);
    }

    console.log('✅ Daily prompt reminder processing complete');
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
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (tokensResult.rows.length === 0) {
      console.log(`  ⏭️ User ${userName} (${userId}): No active push tokens, skipping`);
      return;
    }

    const prefsResult = await pool.query(
      `SELECT daily_prompt_enabled, notifications_enabled, consecutive_skips,
              in_cooldown, cooldown_until, final_reminder_sent, last_reminder_sent_at
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs) {
      console.log(`  ⏭️ User ${userName} (${userId}): No notification preferences row, skipping`);
      return;
    }
    if (!prefs.notifications_enabled) {
      console.log(`  ⏭️ User ${userName} (${userId}): Notifications disabled by user, skipping`);
      return;
    }
    if (!prefs.daily_prompt_enabled) {
      console.log(`  ⏭️ User ${userName} (${userId}): Daily prompt reminders disabled, skipping`);
      return;
    }

    const now = new Date();

    // Check if user is in cooldown period
    if (prefs.in_cooldown) {
      const cooldownUntil = new Date(prefs.cooldown_until);

      if (now >= cooldownUntil && !prefs.final_reminder_sent) {
        const deviceTokens = tokensResult.rows.map(r => r.device_token);

        const notification = {
          title: "We miss your stories",
          body: "It's been a while! Your memories are precious. Share one today?",
          data: {
            type: 'final_reminder',
            userId: userId
          }
        };

        await sendBulkNotifications(deviceTokens, notification);

        await pool.query(
          `UPDATE notification_preferences
           SET final_reminder_sent = TRUE, last_reminder_sent_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );

        await pool.query(
          `INSERT INTO notification_log (user_id, notification_type, title, body, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'final_reminder', notification.title, notification.body, JSON.stringify(notification.data)]
        );

        console.log(`Sent final reminder to user ${userId} after cooldown`);
      }

      return;
    }

    if (prefs.final_reminder_sent) {
      console.log(`  ⏭️ User ${userName} (${userId}): Final reminder already sent, permanently skipping. Reset needed.`);
      return;
    }

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    let notification;
    if (streak >= 5) {
      notification = {
        title: `Keep your ${streak} day streak alive!`,
        body: "Don't break your streak! Answer today's prompt",
        data: {
          type: 'daily_reminder',
          userId: userId,
          streak: streak.toString()
        }
      };
    } else {
      notification = {
        title: "Your daily story awaits",
        body: "Take a moment to answer today's prompt and preserve your memories",
        data: {
          type: 'daily_reminder',
          userId: userId
        }
      };
    }

    const sendResult = await sendBulkNotifications(deviceTokens, notification);
    console.log(`  📤 User ${userName} (${userId}): Sent reminder to ${deviceTokens.length} device(s) - Result: ${JSON.stringify(sendResult)}`);

    const newConsecutiveSkips = (prefs.consecutive_skips || 0) + 1;

    if (newConsecutiveSkips >= 3) {
      const cooldownUntil = new Date();
      cooldownUntil.setDate(cooldownUntil.getDate() + 7);

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
      await pool.query(
        `UPDATE notification_preferences
         SET consecutive_skips = $1, last_reminder_sent_at = NOW()
         WHERE user_id = $2`,
        [newConsecutiveSkips, userId]
      );
    }

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

/**
 * Send weekly reminder to viewers to submit questions
 * @param {object} pool - PostgreSQL pool
 */
async function sendWeeklyViewerReminders(pool) {
  try {
    const viewersResult = await pool.query(
      `SELECT DISTINCT u.id, u.full_name
       FROM users u
       INNER JOIN access_grants ag ON u.id = ag.viewer_id
       WHERE u.role = 'viewer'
       AND ag.is_active = TRUE
       AND (
         u.id NOT IN (
           SELECT submitter_id
           FROM submitted_questions
           WHERE created_at > NOW() - INTERVAL '7 days'
         )
         OR u.id NOT IN (
           SELECT submitter_id FROM submitted_questions
         )
       )`
    );

    console.log(`Found ${viewersResult.rows.length} viewers who haven't submitted questions recently`);

    for (const viewer of viewersResult.rows) {
      await sendViewerReminderNotification(pool, viewer.id, viewer.full_name);
    }

  } catch (error) {
    console.error('Error sending weekly viewer reminders:', error);
  }
}

/**
 * Send reminder notification to a specific viewer to ask questions
 * @param {object} pool - PostgreSQL pool
 * @param {string} viewerId - Viewer user ID
 * @param {string} viewerName - Viewer's name
 */
async function sendViewerReminderNotification(pool, viewerId, viewerName) {
  try {
    const tokensResult = await pool.query(
      `SELECT device_token FROM push_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [viewerId]
    );

    if (tokensResult.rows.length === 0) {
      return;
    }

    const prefsResult = await pool.query(
      `SELECT notifications_enabled, viewer_reminders_enabled
       FROM notification_preferences
       WHERE user_id = $1`,
      [viewerId]
    );

    const prefs = prefsResult.rows[0];
    if (!prefs || !prefs.notifications_enabled || prefs.viewer_reminders_enabled === false) {
      console.log(`Viewer reminders disabled for user ${viewerId}`);
      return;
    }

    const ownersResult = await pool.query(
      `SELECT u.full_name
       FROM users u
       INNER JOIN access_grants ag ON u.id = ag.owner_id
       WHERE ag.viewer_id = $1 AND ag.is_active = TRUE
       LIMIT 3`,
      [viewerId]
    );

    const ownerNames = ownersResult.rows.map(r => r.full_name);
    const ownerText = ownerNames.length === 1
      ? ownerNames[0]
      : ownerNames.length === 2
        ? `${ownerNames[0]} and ${ownerNames[1]}`
        : `${ownerNames[0]}, ${ownerNames[1]}, and others`;

    const deviceTokens = tokensResult.rows.map(r => r.device_token);

    const notification = {
      title: "Ask a question",
      body: `What would you like to know about ${ownerText}? Submit a question for them to answer!`,
      data: {
        type: 'viewer_reminder',
        screen: 'SubmitQuestion'
      }
    };

    await sendBulkNotifications(deviceTokens, notification);

    await pool.query(
      `INSERT INTO notification_log (user_id, notification_type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [viewerId, 'viewer_reminder', notification.title, notification.body, JSON.stringify(notification.data)]
    );

    console.log(`Sent weekly reminder to viewer ${viewerId} (${viewerName})`);

  } catch (error) {
    console.error('Error sending viewer reminder notification:', error);
  }
}

module.exports = {
  sendPushNotification,
  sendBulkNotifications,
  sendDailyPromptNotification,
  sendFamilyQuestionNotification,
  sendResponseReceivedNotification,
  sendStreakReminderNotification,
  sendInviteNotification,
  sendDailyPromptReminders,
  sendDailyPromptReminderNotification,
  resetNotificationCooldown,
  sendWeeklyViewerReminders
};
