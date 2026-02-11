import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function PersonalInfoScreen({ navigation }) {
  const [birthDate, setBirthDate] = useState('');
  const [birthLocation, setBirthLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
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

      // Save personal info if any field is filled
      if (birthDate || birthLocation) {
        // Convert MM/DD/YYYY to YYYY-MM-DD for backend
        const formattedDate = birthDate ? convertToISODate(birthDate) : null;

        await ApiService.updateProfile(token, {
          birthDate: formattedDate,
          birthLocation: birthLocation || null,
        });
      }

      // Navigate to invite screen
      navigation.replace('IntakeInvite');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save your information');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('IntakeInvite');
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tell Us About Yourself</Text>
          <Text style={styles.subtitle}>
            This helps us personalize your experience and preserve important details about your life story.
          </Text>
          <Text style={styles.description}>
            Both fields are optional - you can always add or update this information later in your profile settings.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Birth Date</Text>
          <Text style={styles.hint}>Format: MM/DD/YYYY (e.g., 03/15/1985)</Text>
          <TextInput
            style={styles.input}
            placeholder="03/15/1985"
            value={birthDate}
            onChangeText={setBirthDate}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Birth Location</Text>
          <Text style={styles.hint}>City, State/Province, Country</Text>
          <TextInput
            style={styles.input}
            placeholder="San Francisco, California, USA"
            value={birthLocation}
            onChangeText={setBirthLocation}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleContinue}
            disabled={saving}
          >
            <Text style={styles.buttonPrimaryText}>
              {saving ? 'Saving...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonSkip}
            onPress={handleSkip}
            disabled={saving}
          >
            <Text style={styles.buttonSkipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  form: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 6,
    marginTop: 20,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  footer: {
    marginTop: 20,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#e11d48',
    marginBottom: 12,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSkip: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSkipText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
