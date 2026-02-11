import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './api';

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.currentToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Initialize push notifications
   * Call this on app startup after user is logged in
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('Push notifications already initialized');
      return;
    }

    try {
      console.log('Initializing push notifications...');

      // Request permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.log('Push notification permission denied');
        return;
      }

      // Get Expo Push Token
      await this.getExpoPushToken();

      // Set up notification handlers
      this.setupNotificationHandlers();

      this.isInitialized = true;
      console.log('✅ Push notifications initialized successfully');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    try {
      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Notification permission denied');
        return false;
      }

      console.log('✅ Notification permission granted');
      return true;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Get Expo Push Token and register it with backend
   */
  async getExpoPushToken() {
    try {
      if (!Device.isDevice) {
        throw new Error('Must use physical device for Push Notifications');
      }

      // Get the Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      })).data;

      console.log('📱 Expo Push Token:', token);

      this.currentToken = token;

      // Register token with backend
      await this.registerTokenWithBackend(token);

      return token;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      throw error;
    }
  }

  /**
   * Register device token with backend
   */
  async registerTokenWithBackend(deviceToken) {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (!authToken) {
        console.log('No auth token found, skipping token registration');
        return;
      }

      const deviceType = Platform.OS; // 'ios' or 'android'

      await ApiService.registerPushToken(authToken, deviceToken, deviceType);
      console.log('✅ Device token registered with backend');
    } catch (error) {
      console.error('Failed to register token with backend:', error);
    }
  }

  /**
   * Set up notification handlers for all states
   */
  setupNotificationHandlers() {
    // Handle notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Foreground notification received:', notification);
    });

    // Handle notification responses (user tapped notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📭 Notification tapped:', response);
      this.handleNotificationOpen(response.notification.request.content.data);
    });

    // Handle notification that opened the app (from killed state)
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (response) {
          console.log('📪 Notification opened app from killed state:', response);
          this.handleNotificationOpen(response.notification.request.content.data);
        }
      });
  }

  /**
   * Handle notification tap/open
   * Navigate to appropriate screen based on notification type
   */
  handleNotificationOpen(data) {
    try {
      const notificationType = data?.type;

      console.log('Handling notification:', notificationType, data);

      // Store the notification data for navigation
      AsyncStorage.setItem('pendingNotification', JSON.stringify(data));

      // Navigate if navigation ref is available
      if (global.navigationRef?.current) {
        this.navigateFromNotification(data);
      }
    } catch (error) {
      console.error('Error handling notification open:', error);
    }
  }

  /**
   * Navigate to appropriate screen based on notification data
   */
  navigateFromNotification(data) {
    const { type, questionId, responseId } = data;

    try {
      switch (type) {
        case 'daily_prompt':
        case 'daily_reminder':
          global.navigationRef.current?.navigate('DailyPrompt');
          break;

        case 'family_question':
          if (questionId) {
            global.navigationRef.current?.navigate('DailyPrompt', { questionId });
          } else {
            global.navigationRef.current?.navigate('FamilyQuestions');
          }
          break;

        case 'response_received':
          if (responseId) {
            global.navigationRef.current?.navigate('StoryDetail', { responseId });
          }
          break;

        case 'streak_reminder':
          global.navigationRef.current?.navigate('DailyPrompt');
          break;

        default:
          console.log('Unknown notification type:', type);
          global.navigationRef.current?.navigate('Dashboard');
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  /**
   * Unregister device token (call on logout)
   */
  async unregister() {
    try {
      if (this.currentToken) {
        const authToken = await AsyncStorage.getItem('authToken');
        if (authToken) {
          await ApiService.unregisterPushToken(authToken, this.currentToken);
        }
      }

      // Remove listeners
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }

      this.currentToken = null;
      this.isInitialized = false;

      console.log('✅ Push notifications unregistered');
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }

  /**
   * Check if notifications are enabled
   */
  async checkPermission() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get badge count (iOS only)
   */
  async getBadgeCount() {
    if (Platform.OS === 'ios') {
      return await Notifications.getBadgeCountAsync();
    }
    return 0;
  }

  /**
   * Set badge count (iOS only)
   */
  async setBadgeCount(count) {
    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(count);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }

  /**
   * Schedule a local notification (for testing)
   */
  async scheduleLocalNotification(title, body, data = {}, seconds = 5) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds },
    });
  }
}

// Export singleton instance
export default new PushNotificationService();
