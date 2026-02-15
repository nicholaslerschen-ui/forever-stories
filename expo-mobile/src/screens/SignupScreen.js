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
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('owner'); // Default to owner
  const [inviteCode, setInviteCode] = useState(''); // For reverse invites
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!termsAccepted) {
      Alert.alert('Error', 'Please accept the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.signup(email, password, fullName, role, inviteCode.trim() || null);
      await AsyncStorage.setItem('authToken', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));

      // If owner used reverse invite code, auto-connect was handled by backend
      if (response.reverseInviteUsed) {
        Alert.alert(
          '🎉 Connection Established!',
          `Great news! ${response.viewerName} will now have access to view your stories once you start sharing them.\n\nYou can manage their access anytime from your account settings.`,
          [{ text: 'Continue', onPress: () => navigation.replace('Onboarding') }]
        );
      } else {
        // Viewers get option to invite their parent, owners go through onboarding
        if (role === 'viewer') {
          navigation.replace('InviteParent');
        } else {
          navigation.replace('Onboarding');
        }
      }
    } catch (error) {
      Alert.alert('Signup Failed', error.message);
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
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Who is this account for?</Text>

        {/* Role Selection */}
        <View style={styles.roleContainer}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'owner' && styles.roleCardActive]}
            onPress={() => setRole('owner')}
          >
            <Text style={styles.roleIcon}>📖</Text>
            <Text style={[styles.roleTitle, role === 'owner' && styles.roleTitleActive]}>
              For Myself
            </Text>
            <Text style={styles.roleDescription}>
              I want to preserve my own stories and memories
            </Text>
            {role === 'owner' && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, role === 'viewer' && styles.roleCardActive]}
            onPress={() => setRole('viewer')}
          >
            <Text style={styles.roleIcon}>👨‍👩‍👧‍👦</Text>
            <Text style={[styles.roleTitle, role === 'viewer' && styles.roleTitleActive]}>
              I'm a Loved One
            </Text>
            <Text style={styles.roleDescription}>
              I'm viewing someone else's stories
            </Text>
            {role === 'viewer' && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        </View>

        {/* Invite Code for Owners (Optional) */}
        {role === 'owner' && (
          <View style={styles.inviteCodeSection}>
            <Text style={styles.inviteCodeLabel}>
              Have an invite code from a loved one? (Optional)
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 8-character code"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>
        )}

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Terms and Conditions Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setTermsAccepted(!termsAccepted)}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Text style={styles.checkboxCheck}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I accept the{' '}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL('https://foreverstories.co/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.link}
              onPress={() => Linking.openURL('https://foreverstories.co/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#e11d48',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  roleContainer: {
    marginBottom: 30,
  },
  roleCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
  },
  roleCardActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  roleIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
    color: '#111',
  },
  roleTitleActive: {
    color: '#e11d48',
  },
  roleDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  checkmark: {
    position: 'absolute',
    top: 20,
    right: 20,
    fontSize: 24,
    color: '#e11d48',
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
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    textAlign: 'center',
    color: '#e11d48',
    marginTop: 20,
  },
  inviteCodeSection: {
    marginBottom: 20,
  },
  inviteCodeLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  link: {
    color: '#e11d48',
    textDecorationLine: 'underline',
  },
});
