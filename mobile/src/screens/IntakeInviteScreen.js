import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function IntakeInviteScreen({ navigation }) {
  const [inviteMethod, setInviteMethod] = useState('email'); // 'email' or 'sms'
  const [contacts, setContacts] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState([]); // Array of {contact, success, error}

  const updateContact = (index, value) => {
    const newContacts = [...contacts];
    newContacts[index] = value;
    setContacts(newContacts);
  };

  const addContactField = () => {
    if (contacts.length < 10) {
      setContacts([...contacts, '']);
    }
  };

  const removeContactField = (index) => {
    if (contacts.length > 1) {
      const newContacts = contacts.filter((_, i) => i !== index);
      setContacts(newContacts);
    }
  };

  const handleSendInvites = async () => {
    // Filter out empty contacts and validate based on method
    const validContacts = contacts.filter(c => {
      const trimmed = c.trim();
      if (!trimmed) return false;

      if (inviteMethod === 'email') {
        return trimmed.includes('@');
      } else {
        // Phone: at least 10 digits
        const digits = trimmed.replace(/\D/g, '');
        return digits.length >= 10;
      }
    });

    if (validContacts.length === 0) {
      const fieldType = inviteMethod === 'email' ? 'email address' : 'phone number';
      Alert.alert('No contacts', `Please enter at least one ${fieldType}`);
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      const inviteResults = [];

      for (const contact of validContacts) {
        try {
          if (inviteMethod === 'email') {
            // Send via email using sendInvite (Phase 2 system)
            await ApiService.sendInvite(token, 'email', contact, null);
          } else {
            // Send via SMS using sendInvite (Phase 2 system)
            await ApiService.sendInvite(token, 'sms', null, contact);
          }
          inviteResults.push({ contact, success: true });
        } catch (error) {
          console.error('Failed to invite:', contact, error);
          inviteResults.push({
            contact,
            success: false,
            error: error.message || 'Failed to send'
          });
        }
      }

      // Show results modal
      setResults(inviteResults);
      setShowResults(true);
    } catch (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('Dashboard');
  };

  const handleCloseResults = () => {
    setShowResults(false);
    navigation.replace('Dashboard');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Invite Your Loved Ones 💝</Text>
        <Text style={styles.subtitle}>
          Share your stories with the people who matter most. They'll be able to read your stories,
          chat with your AI persona, and submit questions for you to answer.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🎁</Text>
          <Text style={styles.infoText}>
            Invitations are completely optional. You can always invite people later from your account settings.
          </Text>
        </View>

        {/* Invite Method Toggle */}
        <View style={styles.methodToggle}>
          <TouchableOpacity
            style={[styles.methodButton, inviteMethod === 'email' && styles.methodButtonActive]}
            onPress={() => setInviteMethod('email')}
          >
            <Text style={[styles.methodButtonText, inviteMethod === 'email' && styles.methodButtonTextActive]}>
              Email
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodButton, inviteMethod === 'sms' && styles.methodButtonActive]}
            onPress={() => setInviteMethod('sms')}
          >
            <Text style={[styles.methodButtonText, inviteMethod === 'sms' && styles.methodButtonTextActive]}>
              Text Message
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>
          {inviteMethod === 'email' ? 'Email Addresses' : 'Phone Numbers'}
        </Text>
        <Text style={styles.hint}>
          {inviteMethod === 'email'
            ? 'Enter the email addresses of people you\'d like to invite'
            : 'Enter phone numbers (US format: 555-123-4567)'}
        </Text>

        {contacts.map((contact, index) => (
          <View key={index} style={styles.contactRow}>
            <TextInput
              style={styles.input}
              placeholder={inviteMethod === 'email' ? `Email ${index + 1}` : `Phone ${index + 1}`}
              keyboardType={inviteMethod === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              value={contact}
              onChangeText={(value) => updateContact(index, value)}
            />
            {contacts.length > 1 && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeContactField(index)}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {contacts.length < 10 && (
          <TouchableOpacity style={styles.addButton} onPress={addContactField}>
            <Text style={styles.addButtonText}>
              + Add another {inviteMethod === 'email' ? 'email' : 'phone'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.sendButton, loading && styles.buttonDisabled]}
          onPress={handleSendInvites}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send Invitations</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={loading}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Results Modal */}
      <Modal
        visible={showResults}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseResults}
      >
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Invitation Results</Text>
            <Text style={styles.resultsSubtitle}>
              {results.filter(r => r.success).length} of {results.length} sent successfully
            </Text>
            {results.filter(r => r.success).length > 0 && (
              <View style={styles.accessInfoCard}>
                <Text style={styles.accessInfoIcon}>ℹ️</Text>
                <Text style={styles.accessInfoText}>
                  Once they create an account using the invite code, they'll be able to view your stories and submit questions for you to answer.
                </Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.resultsList}>
            {results.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <Text style={styles.resultIcon}>
                  {result.success ? '✓' : '✕'}
                </Text>
                <View style={styles.resultContent}>
                  <Text style={[
                    styles.resultContact,
                    result.success ? styles.resultSuccess : styles.resultFailure
                  ]}>
                    {result.contact}
                  </Text>
                  {!result.success && result.error && (
                    <Text style={styles.resultError}>{result.error}</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseResults}
          >
            <Text style={styles.closeButtonText}>Continue to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#e11d48',
  },
  methodButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  methodButtonTextActive: {
    color: '#fff',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  removeButton: {
    marginLeft: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#dc2626',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 30,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: '#e11d48',
    fontSize: 15,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#e11d48',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 15,
  },
  spacer: {
    height: 40,
  },
  // Results Modal Styles
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  accessInfoCard: {
    marginTop: 16,
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  accessInfoIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  accessInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  resultsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultIcon: {
    fontSize: 24,
    marginRight: 12,
    width: 30,
  },
  resultContent: {
    flex: 1,
  },
  resultContact: {
    fontSize: 16,
    fontWeight: '500',
  },
  resultSuccess: {
    color: '#059669',
  },
  resultFailure: {
    color: '#dc2626',
  },
  resultError: {
    fontSize: 13,
    color: '#991b1b',
    marginTop: 4,
    fontStyle: 'italic',
  },
  closeButton: {
    backgroundColor: '#e11d48',
    padding: 16,
    margin: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
