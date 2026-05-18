import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const TIME_OPTIONS = [];
for (let h = 6; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const label = `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    TIME_OPTIONS.push({ label, value: hour24 });
  }
}

function formatTimeDisplay(time24) {
  if (!time24) return '9:00 AM';
  const parts = time24.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour12}:${m} ${ampm}`;
}

export default function NotificationSettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(null); // null or 'daily_prompt_time' or 'streak_reminder_time'
  const [preferences, setPreferences] = useState({
    notifications_enabled: true,
    daily_prompt_enabled: true,
    daily_prompt_time: '09:00',
    family_questions_enabled: true,
    responses_received_enabled: true,
    streak_reminders_enabled: true,
    streak_reminder_time: '20:00',
    invites_enabled: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const prefs = await ApiService.getNotificationPreferences(token);
      setPreferences(prefs);
    } catch (error) {
      console.error('❌ Failed to load preferences:', error);
      console.error('❌ Error details:', error.message);
      Alert.alert('Error', `Failed to load notification settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key, value) => {
    // If master switch is being turned off, ask for confirmation
    if (key === 'notifications_enabled' && !value) {
      Alert.alert(
        'Disable All Notifications?',
        'This will turn off all push notifications from Forever Stories.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => savePreference(key, value),
          },
        ]
      );
      return;
    }

    savePreference(key, value);
  };

  const savePreference = async (key, value) => {
    // Optimistically update UI
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.updateNotificationPreferences(token, { [key]: value });
    } catch (error) {
      // Revert on error
      setPreferences(preferences);
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e11d48" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Back Button Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <Text style={styles.headerSubtitle}>
          Manage which notifications you receive
        </Text>
      </View>

      {/* Master Switch */}
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Enable Notifications</Text>
            <Text style={styles.settingDescription}>
              Master switch for all push notifications
            </Text>
          </View>
          <Switch
            value={preferences.notifications_enabled}
            onValueChange={(value) =>
              updatePreference('notifications_enabled', value)
            }
            trackColor={{ false: '#ccc', true: '#fecdd3' }}
            thumbColor={preferences.notifications_enabled ? '#e11d48' : '#999'}
            disabled={saving}
          />
        </View>
      </View>

      {/* Individual Notification Types */}
      <View
        style={[
          styles.section,
          !preferences.notifications_enabled && styles.sectionDisabled,
        ]}
      >
        <Text style={styles.sectionTitle}>Notification Types</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Daily Prompt Reminders</Text>
            <Text style={styles.settingDescription}>
              Get reminded to share your daily story
            </Text>
          </View>
          <Switch
            value={preferences.daily_prompt_enabled}
            onValueChange={(value) =>
              updatePreference('daily_prompt_enabled', value)
            }
            trackColor={{ false: '#ccc', true: '#fecdd3' }}
            thumbColor={preferences.daily_prompt_enabled ? '#e11d48' : '#999'}
            disabled={!preferences.notifications_enabled || saving}
          />
        </View>

        {preferences.daily_prompt_enabled && preferences.notifications_enabled && (
          <TouchableOpacity
            style={styles.timePickerRow}
            onPress={() => setShowTimePicker('daily_prompt_time')}
          >
            <Text style={styles.timePickerLabel}>Reminder Time</Text>
            <Text style={styles.timePickerValue}>
              {formatTimeDisplay(preferences.daily_prompt_time)}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Questions from Loved Ones</Text>
            <Text style={styles.settingDescription}>
              When someone asks you a question
            </Text>
          </View>
          <Switch
            value={preferences.family_questions_enabled}
            onValueChange={(value) =>
              updatePreference('family_questions_enabled', value)
            }
            trackColor={{ false: '#ccc', true: '#fecdd3' }}
            thumbColor={
              preferences.family_questions_enabled ? '#e11d48' : '#999'
            }
            disabled={!preferences.notifications_enabled || saving}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Responses Received</Text>
            <Text style={styles.settingDescription}>
              When someone answers your question
            </Text>
          </View>
          <Switch
            value={preferences.responses_received_enabled}
            onValueChange={(value) =>
              updatePreference('responses_received_enabled', value)
            }
            trackColor={{ false: '#ccc', true: '#fecdd3' }}
            thumbColor={
              preferences.responses_received_enabled ? '#e11d48' : '#999'
            }
            disabled={!preferences.notifications_enabled || saving}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Invitations</Text>
            <Text style={styles.settingDescription}>
              When you're invited to view or share stories
            </Text>
          </View>
          <Switch
            value={preferences.invites_enabled}
            onValueChange={(value) =>
              updatePreference('invites_enabled', value)
            }
            trackColor={{ false: '#ccc', true: '#fecdd3' }}
            thumbColor={preferences.invites_enabled ? '#e11d48' : '#999'}
            disabled={!preferences.notifications_enabled || saving}
          />
        </View>
      </View>

      {/* Information Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Smart Notifications</Text>
        <Text style={styles.infoText}>
          We respect your time. If you don't engage with 3 reminders in a row,
          we'll pause notifications for a week, then send one final reminder.
        </Text>
      </View>

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#e11d48" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      {/* Time Picker Modal */}
      <Modal
        visible={!!showTimePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTimePicker(null)}
      >
        <View style={styles.timeModalOverlay}>
          <View style={styles.timeModalContainer}>
            <View style={styles.timeModalHeader}>
              <Text style={styles.timeModalTitle}>
                {showTimePicker === 'daily_prompt_time'
                  ? 'Daily Reminder Time'
                  : 'Streak Reminder Time'}
              </Text>
              <TouchableOpacity onPress={() => setShowTimePicker(null)}>
                <Text style={styles.timeModalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected =
                  showTimePicker && preferences[showTimePicker]?.startsWith(item.value);
                return (
                  <TouchableOpacity
                    style={[
                      styles.timeOption,
                      isSelected && styles.timeOptionSelected,
                    ]}
                    onPress={() => {
                      savePreference(showTimePicker, item.value);
                      setShowTimePicker(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        isSelected && styles.timeOptionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Text style={styles.timeOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  topBar: {
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#e11d48',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 15,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  infoSection: {
    backgroundColor: '#eff6ff',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 19,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  savingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 15,
  },
  timePickerLabel: {
    fontSize: 14,
    color: '#666',
  },
  timePickerValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e11d48',
  },
  timeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timeModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timeModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  timeModalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e11d48',
  },
  timeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  timeOptionSelected: {
    backgroundColor: '#fef2f2',
  },
  timeOptionText: {
    fontSize: 16,
    color: '#333',
  },
  timeOptionTextSelected: {
    color: '#e11d48',
    fontWeight: '600',
  },
  timeOptionCheck: {
    fontSize: 18,
    color: '#e11d48',
    fontWeight: 'bold',
  },
});
