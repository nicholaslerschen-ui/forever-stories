import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useFontSize } from '../context/FontSizeContext';
import NotificationService from '../services/notifications';

export default function SettingsScreen({ navigation }) {
  const { fontSizeMultiplier, updateFontSize, getFontSize } = useFontSize();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const fontSizeOptions = [
    { label: 'Small', value: 0.85 },
    { label: 'Medium', value: 1.0 },
    { label: 'Large', value: 1.15 },
    { label: 'Extra Large', value: 1.3 },
  ];

  const timeOptions = [
    { label: '7:00 AM', value: '07:00' },
    { label: '8:00 AM', value: '08:00' },
    { label: '9:00 AM', value: '09:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '5:00 PM', value: '17:00' },
    { label: '7:00 PM', value: '19:00' },
    { label: '9:00 PM', value: '21:00' },
  ];

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const settings = await NotificationService.getNotificationSettings();
      setNotificationsEnabled(settings.enabled);
      setNotificationTime(settings.time);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const isNotificationsAvailable = NotificationService.isAvailable();

  const handleToggleNotifications = async (value) => {
    setLoading(true);
    try {
      if (value) {
        // Request permissions first
        const permissionResult = await NotificationService.requestPermissions();
        if (!permissionResult.granted) {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive daily reminders.',
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }

        // Schedule notification
        const [hour, minute] = notificationTime.split(':').map(Number);
        const result = await NotificationService.scheduleDailyReminder(hour, minute);

        if (result.success) {
          setNotificationsEnabled(true);
          await NotificationService.saveNotificationSettings({
            enabled: true,
            time: notificationTime,
          });
          Alert.alert('Success', 'Daily reminders enabled!');
        } else {
          Alert.alert('Error', 'Failed to schedule notifications');
        }
      } else {
        // Cancel notifications
        await NotificationService.cancelAllNotifications();
        setNotificationsEnabled(false);
        await NotificationService.saveNotificationSettings({
          enabled: false,
          time: notificationTime,
        });
        Alert.alert('Success', 'Daily reminders disabled');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = async (newTime) => {
    setNotificationTime(newTime);
    await NotificationService.saveNotificationSettings({
      enabled: notificationsEnabled,
      time: newTime,
    });

    // If notifications are already enabled, reschedule with new time
    if (notificationsEnabled) {
      const [hour, minute] = newTime.split(':').map(Number);
      await NotificationService.scheduleDailyReminder(hour, minute);
      Alert.alert('Success', 'Reminder time updated!');
    }
  };

  const handleShareApp = async () => {
    try {
      const result = await Share.share({
        message:
          'Check out Forever Stories - preserve your family memories and life stories! ' +
          'A beautiful app to answer daily prompts, write your stories, and share them with family. ' +
          'Download it today!',
        title: 'Forever Stories App',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type
          Alert.alert('Success', 'Thanks for sharing!');
        } else {
          // Shared
          Alert.alert('Success', 'Thanks for sharing!');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>Settings</Text>

      {/* Text Size Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>
          Text Size
        </Text>
        <Text style={[styles.sectionSubtitle, { fontSize: getFontSize(14) }]}>
          Choose a comfortable reading size
        </Text>

        <View style={styles.fontSizeContainer}>
          {fontSizeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.fontSizeButton,
                fontSizeMultiplier === option.value && styles.fontSizeButtonActive,
              ]}
              onPress={() => updateFontSize(option.value)}
            >
              <Text
                style={[
                  styles.fontSizeButtonText,
                  { fontSize: getFontSize(14) },
                  fontSizeMultiplier === option.value && styles.fontSizeButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.fontSizePreview,
                  { fontSize: option.value * 20 },
                  fontSizeMultiplier === option.value && styles.fontSizeButtonTextActive,
                ]}
              >
                Aa
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.previewBox}>
          <Text style={[styles.previewText, { fontSize: getFontSize(16) }]}>
            Preview: This is how your text will look in the app.
          </Text>
        </View>
      </View>

      {/* Share App Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>
          Share Forever Stories
        </Text>
        <Text style={[styles.sectionSubtitle, { fontSize: getFontSize(14) }]}>
          Invite friends and family to preserve their stories
        </Text>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareApp}>
          <Text style={[styles.shareButtonText, { fontSize: getFontSize(16) }]}>
            📤 Share App
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>
          Daily Reminders
        </Text>
        <Text style={[styles.sectionSubtitle, { fontSize: getFontSize(14) }]}>
          Get reminded to write your daily story
        </Text>

        {!isNotificationsAvailable ? (
          <View style={styles.setupRequiredCard}>
            <Text style={[styles.setupRequiredTitle, { fontSize: getFontSize(16) }]}>
              ⚙️ Setup Required
            </Text>
            <Text style={[styles.setupRequiredText, { fontSize: getFontSize(14) }]}>
              Notifications require rebuilding the app with native dependencies.
            </Text>
            <Text style={[styles.setupRequiredSteps, { fontSize: getFontSize(13) }]}>
              Steps:{'\n'}
              1. Stop the app{'\n'}
              2. Run: cd ios && pod install && cd ..{'\n'}
              3. Rebuild: npm run ios
            </Text>
          </View>
        ) : (
          <View style={styles.notificationCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationInfo}>
              <Text style={[styles.notificationLabel, { fontSize: getFontSize(16) }]}>
                🔔 Enable Reminders
              </Text>
              <Text style={[styles.notificationDescription, { fontSize: getFontSize(12) }]}>
                Receive a daily notification at your chosen time
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              disabled={loading}
              trackColor={{ false: '#d1d5db', true: '#fecdd3' }}
              thumbColor={notificationsEnabled ? '#e11d48' : '#f3f4f6'}
              ios_backgroundColor="#d1d5db"
            />
          </View>

          {notificationsEnabled && (
            <View style={styles.timeSelector}>
              <Text style={[styles.timeSelectorLabel, { fontSize: getFontSize(14) }]}>
                Reminder Time
              </Text>
              <View style={styles.timeOptions}>
                {timeOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.timeButton,
                      notificationTime === option.value && styles.timeButtonActive,
                    ]}
                    onPress={() => handleTimeChange(option.value)}
                  >
                    <Text
                      style={[
                        styles.timeButtonText,
                        { fontSize: getFontSize(13) },
                        notificationTime === option.value && styles.timeButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
        )}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    marginTop: 50,
    marginLeft: 20,
    marginBottom: 20,
  },
  backText: {
    color: '#e11d48',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 20,
    marginHorizontal: 20,
    color: '#111',
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 5,
  },
  sectionSubtitle: {
    color: '#666',
    marginBottom: 15,
  },
  fontSizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fontSizeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  fontSizeButtonActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  fontSizeButtonText: {
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  fontSizeButtonTextActive: {
    color: '#e11d48',
  },
  fontSizePreview: {
    color: '#666',
    fontWeight: 'bold',
  },
  previewBox: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  previewText: {
    color: '#111',
    lineHeight: 24,
  },
  shareButton: {
    backgroundColor: '#10b981',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  setupRequiredCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 12,
    padding: 15,
  },
  setupRequiredTitle: {
    color: '#92400e',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  setupRequiredText: {
    color: '#92400e',
    marginBottom: 12,
    lineHeight: 20,
  },
  setupRequiredSteps: {
    color: '#78350f',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 6,
    lineHeight: 18,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 15,
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
    marginRight: 15,
  },
  notificationLabel: {
    color: '#111',
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationDescription: {
    color: '#666',
  },
  timeSelector: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  timeSelectorLabel: {
    color: '#111',
    fontWeight: '600',
    marginBottom: 12,
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 0,
  },
  timeButtonActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  timeButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  timeButtonTextActive: {
    color: '#e11d48',
    fontWeight: '600',
  },
  spacer: {
    height: 40,
  },
});
