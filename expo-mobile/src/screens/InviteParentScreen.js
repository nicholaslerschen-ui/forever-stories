import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { shareInvite } from '../utils/shareInvite';

export default function InviteParentScreen({ navigation, route }) {
  const fromDashboard = route.params?.fromDashboard;
  const [sharing, setSharing] = useState(false);

  const handleShareInvite = async () => {
    setSharing(true);
    await shareInvite('viewer');
    setSharing(false);
  };

  const handleSkip = () => {
    fromDashboard ? navigation.goBack() : navigation.replace('Dashboard');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {fromDashboard && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.title, fromDashboard && { marginTop: 10 }]}>
        Invite Someone to Share Their Stories
      </Text>
      <Text style={styles.subtitle}>
        Send an invite to a loved one so they can create their account and share
        their stories with you.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          They'll receive an invite code to use when creating their account. This
          will automatically connect you to their stories.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.shareButton, sharing && styles.buttonDisabled]}
        onPress={handleShareInvite}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.shareButtonText}>Share Invite</Text>
            <Text style={styles.shareButtonSubtext}>
              Send via text, email, or any app
            </Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={styles.acceptCodeButton}
        onPress={() => navigation.navigate('AcceptInvite')}
      >
        <Text style={styles.acceptCodeText}>Already have an invite code?</Text>
        <Text style={styles.acceptCodeSubtext}>
          Enter a code from someone who invited you
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={sharing}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>

      <View style={styles.spacer} />
    </ScrollView>
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
  backButton: {
    marginBottom: 10,
  },
  backText: {
    color: '#e11d48',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  shareButton: {
    backgroundColor: '#e11d48',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#9ca3af',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  acceptCodeButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  acceptCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e11d48',
    marginBottom: 4,
  },
  acceptCodeSubtext: {
    fontSize: 13,
    color: '#6b7280',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  spacer: {
    height: 40,
  },
});
