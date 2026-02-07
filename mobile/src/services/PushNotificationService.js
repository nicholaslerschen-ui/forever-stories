import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './api';

class PushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.currentToken = null;
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

      // Get FCM token
      await this.getFCMToken();

      // Set up notification handlers
      this.setupNotificationHandlers();

      // Set up token refresh listener
      this.setupTokenRefreshListener();

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
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Notification permission granted:', authStatus);
        return true;
      } else {
        console.log('❌ Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token and register it with backend
   */
  async getFCMToken() {
    try {
      // Get the device token
      const token = await messaging().getToken();
      console.log('📱 FCM Token:', token);

      this.currentToken = token;

      // Register token with backend
      await this.registerTokenWithBackend(token);

      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
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
   * Set up token refresh listener
   * Called when FCM token is refreshed
   */
  setupTokenRefreshListener() {
    messaging().onTokenRefresh(async (token) => {
      console.log('🔄 FCM token refreshed:', token);
      this.currentToken = token;
      await this.registerTokenWithBackend(token);
    });
  }

  /**
   * Set up notification handlers for all states
   */
  setupNotificationHandlers() {
    // Handle notifications when app is in foreground
    messaging().onMessage(async (remoteMessage) => {
      console.log('📬 Foreground notification:', remoteMessage);
      await this.displayForegroundNotification(remoteMessage);
    });

    // Handle notification opened when app is in background
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📭 Notification opened app from background:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // Handle notification opened when app was killed
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('📪 Notification opened app from killed state:', remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      });

    // Handle notification interaction with Notifee
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('User pressed notification:', detail.notification);
        this.handleNotificationOpen(detail.notification);
      }
    });
  }

  /**
   * Display notification when app is in foreground
   * Uses Notifee for better control and appearance
   */
  async displayForegroundNotification(remoteMessage) {
    try {
      // Create notification channel for Android
      const channelId = await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
      });

      // Display notification
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'Forever Stories',
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
      });
    } catch (error) {
      console.error('Error displaying foreground notification:', error);
    }
  }

  /**
   * Handle notification tap/open
   * Navigate to appropriate screen based on notification type
   */
  handleNotificationOpen(remoteMessage) {
    try {
      const data = remoteMessage?.data || {};
      const notificationType = data.type;

      console.log('Handling notification:', notificationType, data);

      // Store the notification data for navigation
      // The app navigator will pick this up and navigate accordingly
      AsyncStorage.setItem('pendingNotification', JSON.stringify(data));

      // Emit event for navigation
      // This will be caught by AppNavigator
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

      // Delete FCM token
      await messaging().deleteToken();
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
      const authStatus = await messaging().hasPermission();
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
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
      return await notifee.getBadgeCount();
    }
    return 0;
  }

  /**
   * Set badge count (iOS only)
   */
  async setBadgeCount(count) {
    if (Platform.OS === 'ios') {
      await notifee.setBadgeCount(count);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications() {
    await notifee.cancelAllNotifications();
  }
}

// Export singleton instance
export default new PushNotificationService();
