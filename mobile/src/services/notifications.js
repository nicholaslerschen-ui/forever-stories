import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { TriggerType, RepeatFrequency } from '@notifee/react-native';

const NOTIFICATION_STORAGE_KEY = 'notificationSettings';
const CHANNEL_ID = 'daily-reminders';

class NotificationService {
  constructor() {
    this.initialize();
  }

  async initialize() {
    // Create notification channel for Android (iOS doesn't need this)
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Daily Reminders',
        sound: 'default',
        importance: 4, // HIGH
      });
    }
  }

  isAvailable() {
    return true; // Notifee is always available once installed
  }

  async requestPermissions() {
    try {
      const settings = await notifee.requestPermission();

      if (settings.authorizationStatus >= 1) {
        // 1 = authorized, 2 = provisional
        return { granted: true };
      }

      return {
        granted: false,
        error: 'Permission not granted'
      };
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return { granted: false, error: error.message };
    }
  }

  async checkPermissions() {
    try {
      const settings = await notifee.getNotificationSettings();
      return settings.authorizationStatus >= 1;
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }

  async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (settings) {
        return JSON.parse(settings);
      }
      return {
        enabled: false,
        time: '09:00', // Default to 9 AM
      };
    } catch (error) {
      console.error('Error loading notification settings:', error);
      return { enabled: false, time: '09:00' };
    }
  }

  async saveNotificationSettings(settings) {
    try {
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Error saving notification settings:', error);
      return false;
    }
  }

  async scheduleDailyReminder(hour, minute) {
    try {
      // Cancel all existing notifications first
      await notifee.cancelAllNotifications();

      // Create trigger for daily notification
      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: this.getNextTriggerTime(hour, minute),
        repeatFrequency: RepeatFrequency.DAILY,
      };

      // Schedule notification
      await notifee.createTriggerNotification(
        {
          title: '📖 Time to write your story',
          body: 'Your daily prompt is waiting for you. Share your memories today!',
          ios: {
            sound: 'default',
            categoryId: 'daily_reminder',
          },
          android: {
            channelId: CHANNEL_ID,
            sound: 'default',
            pressAction: {
              id: 'default',
            },
          },
          data: {
            type: 'daily_reminder',
          },
        },
        trigger
      );

      return { success: true };
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return { success: false, error: error.message };
    }
  }

  getNextTriggerTime(hour, minute) {
    const now = new Date();
    const triggerTime = new Date();
    triggerTime.setHours(hour);
    triggerTime.setMinutes(minute);
    triggerTime.setSeconds(0);
    triggerTime.setMilliseconds(0);

    // If the time has already passed today, schedule for tomorrow
    if (triggerTime <= now) {
      triggerTime.setDate(triggerTime.getDate() + 1);
    }

    return triggerTime.getTime();
  }

  async cancelAllNotifications() {
    try {
      await notifee.cancelAllNotifications();
      return { success: true };
    } catch (error) {
      console.error('Error canceling notifications:', error);
      return { success: false, error: error.message };
    }
  }

  async getScheduledNotifications() {
    try {
      const notifications = await notifee.getTriggerNotifications();
      return notifications;
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Set up notification press handler
  setupNotificationResponseListener(navigation) {
    // Listen for notification press events
    return notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === 1) { // PRESS event
        const data = detail.notification?.data;

        if (data?.type === 'daily_reminder' && navigation) {
          navigation.navigate('DailyPrompt');
        }
      }
    });
  }
}

export default new NotificationService();
