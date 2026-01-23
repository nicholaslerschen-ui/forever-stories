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

  // Life Events & Interests
  const [lifeEvents, setLifeEvents] = useState('');
  const [interests, setInterests] = useState('');

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
      setBirthDate(account.birth_date || '');
      setBirthLocation(account.birth_location || '');
      setTimezone(account.timezone || 'America/Phoenix');

      // Handle life events and interests
      if (account.life_events) {
        const events = Array.isArray(account.life_events)
          ? account.life_events.join(', ')
          : account.life_events;
        setLifeEvents(events);
      }

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
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.updateProfile(token, {
        birthDate: birthDate || null,
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

  const handleSaveLifeEventsInterests = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      // Convert comma-separated strings to arrays
      const eventsArray = lifeEvents
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

      const interestsArray = interests
        .split(',')
        .map(i => i.trim())
        .filter(Boolean);

      await ApiService.updateProfile(token, {
        lifeEvents: eventsArray,
        interests: interestsArray,
      });

      Alert.alert('Success', 'Life events and interests updated successfully');
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
              placeholder="YYYY-MM-DD"
              value={birthDate}
              onChangeText={setBirthDate}
            />

            <Text style={styles.label}>Birth Location</Text>
            <TextInput
              style={styles.input}
              placeholder="City, State/Country"
              value={birthLocation}
              onChangeText={setBirthLocation}
            />

            <Text style={styles.label}>Timezone</Text>
            <TextInput
              style={styles.input}
              placeholder="America/Phoenix"
              value={timezone}
              onChangeText={setTimezone}
            />

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
            <Text style={styles.hint}>Separate with commas</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Marriage, First job, Birth of child, etc."
              multiline
              numberOfLines={4}
              value={lifeEvents}
              onChangeText={setLifeEvents}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Interests</Text>
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
              onPress={handleSaveLifeEventsInterests}
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
      </ScrollView>
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
});
