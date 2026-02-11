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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function InviteParentScreen({ navigation }) {
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendInvite = async () => {
    if (method === 'email' && !email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (method === 'sms' && !phone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const result = await ApiService.sendReverseInvite(
        token,
        method,
        method === 'email' ? email.trim() : null,
        method === 'sms' ? phone.trim() : null
      );

      Alert.alert(
        'Invite Sent!',
        `They will receive an invite code: ${result.inviteCode}. They can use this when they create their account.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.replace('Dashboard')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('Dashboard');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Invite Someone to Share Their Stories</Text>
      <Text style={styles.subtitle}>
        Send an invite to a loved one so they can create their account and share their stories with you
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 They'll receive an invite code to use when creating their account. This will automatically connect you to their stories.
        </Text>
      </View>

      {/* Method Selection */}
      <Text style={styles.label}>Send invite via:</Text>
      <View style={styles.methodContainer}>
        <TouchableOpacity
          style={[styles.methodButton, method === 'email' && styles.methodButtonActive]}
          onPress={() => setMethod('email')}
        >
          <Text style={[styles.methodText, method === 'email' && styles.methodTextActive]}>
            📧 Email
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.methodButton, method === 'sms' && styles.methodButtonActive]}
          onPress={() => setMethod('sms')}
        >
          <Text style={[styles.methodText, method === 'sms' && styles.methodTextActive]}>
            💬 Text Message
          </Text>
        </TouchableOpacity>
      </View>

      {/* Email Input */}
      {method === 'email' && (
        <>
          <Text style={styles.inputLabel}>Their Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </>
      )}

      {/* SMS Input */}
      {method === 'sms' && (
        <>
          <Text style={styles.inputLabel}>Their Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 (555) 123-4567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </>
      )}

      <TouchableOpacity
        style={[styles.sendButton, loading && styles.buttonDisabled]}
        onPress={handleSendInvite}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.sendButtonText}>Send Invite</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 60,
    marginBottom: 10,
    color: '#111',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111',
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
  },
  methodButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  methodButtonActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  methodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  methodTextActive: {
    color: '#e11d48',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 24,
  },
  sendButton: {
    backgroundColor: '#e11d48',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
