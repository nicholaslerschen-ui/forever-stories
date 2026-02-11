import { useEffect, useState } from 'react';
import PushNotificationService from '../services/PushNotificationService';

/**
 * React hook for managing push notifications
 * Usage:
 *   const { isEnabled, requestPermission } = usePushNotifications();
 */
export function usePushNotifications() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if notifications are enabled on mount
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const enabled = await PushNotificationService.checkPermission();
    setIsEnabled(enabled);
  };

  const initialize = async () => {
    try {
      await PushNotificationService.initialize();
      setIsInitialized(true);
      await checkPermission();
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  };

  const requestPermission = async () => {
    try {
      const granted = await PushNotificationService.requestPermission();
      setIsEnabled(granted);

      if (granted && !isInitialized) {
        await initialize();
      }

      return granted;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return false;
    }
  };

  const unregister = async () => {
    try {
      await PushNotificationService.unregister();
      setIsEnabled(false);
      setIsInitialized(false);
    } catch (error) {
      console.error('Failed to unregister:', error);
    }
  };

  return {
    isEnabled,
    isInitialized,
    initialize,
    requestPermission,
    unregister,
    checkPermission,
  };
}
