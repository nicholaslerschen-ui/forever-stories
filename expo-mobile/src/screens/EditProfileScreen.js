import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import TimezonePicker from '../components/TimezonePicker';

const LIFE_EVENTS = [
  { id: 'parenthood', label: 'Parenthood', icon: '👶', description: 'Raising children' },
  { id: 'siblings', label: 'Siblings', icon: '👫', description: 'Growing up with brothers or sisters' },
  { id: 'partnership_marriage', label: 'Partnership/Marriage', icon: '💑', description: 'Long-term relationship or marriage' },
  { id: 'college_education', label: 'College Education', icon: '🎓', description: 'University or higher education' },
  { id: 'immigration', label: 'Immigration', icon: '✈️', description: 'Moving to a new country' },
  { id: 'military_service', label: 'Military Service', icon: '🎖️', description: 'Serving in the military' },
  { id: 'career_pivot', label: 'Career Change', icon: '💼', description: 'Major career transition' },
  { id: 'major_move', label: 'Major Move', icon: '🏡', description: 'Relocating to a new place' },
  { id: 'loss_grief', label: 'Loss/Grief', icon: '🕊️', description: 'Experiencing significant loss' },
  { id: 'caregiving', label: 'Caregiving', icon: '🤝', description: 'Caring for family member' },
  { id: 'faith_community', label: 'Faith Community', icon: '🙏', description: 'Active in religious/spiritual group' },
  { id: 'sports_competition', label: 'Sports/Competition', icon: '⚽', description: 'Competitive athletics' },
  { id: 'creative_hobby', label: 'Creative Pursuit', icon: '🎨', description: 'Art, music, or creative hobby' },
];

export default function EditProfileScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Basic Info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Personal Details
  const [birthDate, setBirthDate] = useState('');
  const [birthLocation, setBirthLocation] = useState('');
  const [timezone, setTimezone] = useState('');

  // Life Events (structured) & Interests
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [interests, setInterests] = useState('');

  // UI State
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);

  useEffect(() => {
    loadAccountData();
  }, []);

  const loadAccountData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const accountData = await ApiService.getUserAccount(token);
      const account = accountData.account;

      setFullName(account.full_name || '');
      setEmail(account.email || '');
      // Convert YYYY-MM-DD to MM/DD/YYYY for display
      setBirthDate(account.birth_date ? convertToDisplayDate(account.birth_date) : '');
      setBirthLocation(account.birth_location || '');
      setTimezone(account.timezone || 'America/Phoenix');

      // Load unlocked life event gates
      const gatesResult = await ApiService.getUnlockedGates(token);
      const unlockedTags = gatesResult.gates.map(gate => gate.gate_tag);
      setSelectedEvents(new Set(unlockedTags));

      // Handle interests
      if (account.interests) {
        const ints = Array.isArray(account.interests)
          ? account.interests.join(', ')
          : account.interests;
        setInterests(ints);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Valid email is required');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.updateBasicInfo(token, fullName, email);

      // Update stored user data
      const userData = { fullName, email };
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'All password fields are required');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.updatePassword(token, currentPassword, newPassword);

      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePersonalDetails = async () => {
    // Validate birth date format if provided
    if (birthDate && !isValidDate(birthDate)) {
      Alert.alert('Invalid Date', 'Please enter date in MM/DD/YYYY format (e.g., 03/15/1985)');
      return;
    }

    // Validate birth location if provided
    if (birthLocation && !isValidBirthLocation(birthLocation)) {
      Alert.alert(
        'Invalid Birth Location',
        'Please enter a valid location in the format: City, State/Province, Country (e.g., San Francisco, California, USA)'
      );
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      // Convert MM/DD/YYYY to YYYY-MM-DD for backend
      const formattedDate = birthDate ? convertToISODate(birthDate) : null;

      await ApiService.updateProfile(token, {
        birthDate: formattedDate,
        birthLocation: birthLocation || null,
        timezone: timezone || 'America/Phoenix',
      });

      Alert.alert('Success', 'Personal details updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const isValidDate = (dateString) => {
    // Basic validation for MM/DD/YYYY format
    const regex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!regex.test(dateString)) return false;

    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date instanceof Date && !isNaN(date) &&
           date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
  };

  const isValidBirthLocation = (location) => {
    const trimmed = location.trim();

    // Length validation (3-200 characters)
    if (trimmed.length < 3 || trimmed.length > 200) {
      return false;
    }

    // Should contain at least one comma (separating city from state/country)
    if (!trimmed.includes(',')) {
      return false;
    }

    // Should have at least 2 parts (city, country or city, state, country)
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) {
      return false;
    }

    // Each part should have at least 2 characters
    for (const part of parts) {
      if (part.length < 2) {
        return false;
      }
    }

    // Allow only letters, spaces, hyphens, apostrophes, and periods (for abbreviations)
    const validPattern = /^[a-zA-Z\s,\-'.()]+$/;
    if (!validPattern.test(trimmed)) {
      return false;
    }

    return true;
  };

  const convertToISODate = (dateString) => {
    // Convert MM/DD/YYYY to YYYY-MM-DD
    const [month, day, year] = dateString.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const convertToDisplayDate = (isoDateString) => {
    // Convert YYYY-MM-DD to MM/DD/YYYY
    const date = new Date(isoDateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const toggleEvent = async (eventId) => {
    const token = await AsyncStorage.getItem('authToken');
    const newSelected = new Set(selectedEvents);
    const isCurrentlySelected = newSelected.has(eventId);

    // Optimistic UI update
    if (isCurrentlySelected) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);

    // Save to backend
    try {
      if (isCurrentlySelected) {
        // Remove the gate
        await ApiService.removeGate(token, eventId);
      } else {
        // Add the gate
        await ApiService.unlockGates(token, [eventId]);
      }
    } catch (error) {
      // Revert on error
      if (isCurrentlySelected) {
        newSelected.add(eventId);
      } else {
        newSelected.delete(eventId);
      }
      setSelectedEvents(newSelected);
      Alert.alert('Error', error.message || 'Failed to update life events');
    }
  };

  const handleSaveInterests = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      // Convert comma-separated strings to arrays
      const interestsArray = interests
        .split(',')
        .map(i => i.trim())
        .filter(Boolean);

      await ApiService.updateProfile(token, {
        interests: interestsArray,
      });

      Alert.alert('Success', 'Interests updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Edit Profile</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'basic' && styles.activeTab]}
          onPress={() => setActiveTab('basic')}
        >
          <Text style={[styles.tabText, activeTab === 'basic' && styles.activeTabText]}>
            Basic
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'password' && styles.activeTab]}
          onPress={() => setActiveTab('password')}
        >
          <Text style={[styles.tabText, activeTab === 'password' && styles.activeTabText]}>
            Password
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.activeTab]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
            Details
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'life' && styles.activeTab]}
          onPress={() => setActiveTab('life')}
        >
          <Text style={[styles.tabText, activeTab === 'life' && styles.activeTabText]}>
            Life
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <View>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your.email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSaveBasicInfo}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <View>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Personal Details Tab */}
        {activeTab === 'details' && (
          <View>
            <Text style={styles.label}>Birth Date</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              value={birthDate}
              onChangeText={setBirthDate}
            />

            <Text style={styles.label}>Birth Location</Text>
            <Text style={styles.hint}>Format: City, State/Province, Country</Text>
            <TextInput
              style={styles.input}
              placeholder="San Francisco, California, USA"
              value={birthLocation}
              onChangeText={setBirthLocation}
            />

            <Text style={styles.label}>Timezone</Text>
            <Text style={styles.hint}>Tap to select your timezone</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTimezonePicker(true)}
            >
              <Text style={[styles.pickerButtonText, !timezone && styles.pickerButtonPlaceholder]}>
                {timezone || 'Select timezone...'}
              </Text>
              <Text style={styles.pickerButtonIcon}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSavePersonalDetails}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Life Events & Interests Tab */}
        {activeTab === 'life' && (
          <View>
            <Text style={styles.label}>Life Events</Text>
            <Text style={styles.hint}>
              Select life experiences to personalize your prompts. Changes are saved automatically.
            </Text>

            <View style={styles.eventsContainer}>
              {LIFE_EVENTS.map((event) => {
                const isSelected = selectedEvents.has(event.id);
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventCard, isSelected && styles.eventCardSelected]}
                    onPress={() => toggleEvent(event.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eventIcon}>{event.icon}</Text>
                    <View style={styles.eventContent}>
                      <Text style={[styles.eventLabel, isSelected && styles.eventLabelSelected]}>
                        {event.label}
                      </Text>
                      <Text style={[styles.eventDescription, isSelected && styles.eventDescriptionSelected]}>
                        {event.description}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 30 }]}>Interests</Text>
            <Text style={styles.hint}>Separate with commas</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Family, Career, Travel, Hobbies, etc."
              multiline
              numberOfLines={4}
              value={interests}
              onChangeText={setInterests}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSaveInterests}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Interests</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <TimezonePicker
        visible={showTimezonePicker}
        onClose={() => setShowTimezonePicker(false)}
        onSelectTimezone={setTimezone}
        currentTimezone={timezone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    marginTop: 50,
    marginLeft: 20,
    marginBottom: 20,
  },
  backText: {
    color: '#e11d48',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    marginHorizontal: 20,
    color: '#111',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#e11d48',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#e11d48',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 15,
    color: '#111',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    backgroundColor: '#f9fafb',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#111',
  },
  pickerButtonPlaceholder: {
    color: '#9ca3af',
  },
  pickerButtonIcon: {
    fontSize: 24,
    color: '#6b7280',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
  },
  saveButton: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventsContainer: {
    gap: 12,
    marginTop: 15,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  eventCardSelected: {
    borderColor: '#e11d48',
    backgroundColor: '#fff1f2',
  },
  eventIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  eventLabelSelected: {
    color: '#e11d48',
  },
  eventDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  eventDescriptionSelected: {
    color: '#be123c',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
