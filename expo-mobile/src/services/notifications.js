import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const NOTIFICATION_STORAGE_KEY = 'notificationSettings';
const DAILY_REMINDER_ID = 'daily-reminder';

class NotificationService {
  constructor() {
    this.initialize();
  }

  async initialize() {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Set up notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reminders', {
        name: 'Daily Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  }

  isAvailable() {
    return true; // Expo notifications are always available
  }

  async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
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
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
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
      // Cancel all existing scheduled notifications first
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Schedule daily notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📖 Time to write your story',
          body: 'Your daily prompt is waiting for you. Share your memories today!',
          sound: 'default',
          data: {
            type: 'daily_reminder',
          },
        },
        trigger: {
          hour: hour,
          minute: minute,
          repeats: true,
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return { success: false, error: error.message };
    }
  }

  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return { success: true };
    } catch (error) {
      console.error('Error canceling notifications:', error);
      return { success: false, error: error.message };
    }
  }

  async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications;
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Set up notification press handler
  setupNotificationResponseListener(navigation) {
    // Listen for notification press events
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (data?.type === 'daily_reminder' && navigation) {
        navigation.navigate('DailyPrompt');
      }
    });

    return subscription;
  }
}

export default new NotificationService();
