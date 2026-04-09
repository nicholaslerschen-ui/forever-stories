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
} from 'react-native';
import ApiService from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState('email'); // 'email' or 'reset'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await ApiService.forgotPassword(email.trim().toLowerCase());
      Alert.alert(
        'Code Sent',
        'If an account exists with that email, we sent a 6-digit reset code. Check your inbox.',
        [{ text: 'OK', onPress: () => setStep('reset') }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the 6-digit code from your email');
      return;
    }
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (!/\d/.test(newPassword)) {
      Alert.alert('Error', 'Password must contain at least one number');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await ApiService.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. Please log in with your new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Reset Password</Text>

        {step === 'email' ? (
          <>
            <Text style={styles.description}>
              Enter the email address associated with your account and we'll send you a code to reset your password.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.description}>
              Enter the 6-digit code sent to {email} and choose a new password.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TextInput
              style={styles.input}
              placeholder="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSendCode} disabled={loading}>
              <Text style={styles.resendText}>Didn't get the code? Send again</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  backButton: {
    marginTop: 50,
    marginBottom: 20,
  },
  backText: {
    color: '#e11d48',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111',
  },
  description: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 25,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendText: {
    textAlign: 'center',
    color: '#e11d48',
    marginTop: 20,
    fontSize: 14,
  },
});
