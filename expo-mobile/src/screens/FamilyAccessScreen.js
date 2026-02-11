import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import ContactPicker from '../components/ContactPicker';

export default function FamilyAccessScreen({ navigation }) {
  const [method, setMethod] = useState('email'); // 'email' or 'sms'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showContactPicker, setShowContactPicker] = useState(false);

  useEffect(() => {
    loadViewers();
  }, []);

  const loadViewers = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getMyViewers(token);
      setViewers(data.viewers);
    } catch (error) {
      console.error('Load viewers error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    // Validate based on method
    if (method === 'email') {
      if (!email.trim() || !email.includes('@')) {
        Alert.alert('Error', 'Please enter a valid email address');
        return;
      }
    } else {
      if (!phone.trim()) {
        Alert.alert('Error', 'Please enter a phone number');
        return;
      }
    }

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const result = await ApiService.sendInvite(token, method, email, phone);

      const recipient = method === 'email' ? email : phone;
      const methodLabel = method === 'email' ? 'email' : 'text message';

      Alert.alert(
        'Invitation Sent!',
        `Invite code: ${result.inviteCode}\n\nA ${methodLabel} has been sent to ${recipient}`,
        [{ text: 'OK' }]
      );

      setEmail('');
      setPhone('');
      loadViewers(); // Refresh list
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSending(false);
    }
  };

  const toggleAccess = async (grantId, currentlyActive, viewerName) => {
    const action = currentlyActive ? 'turn OFF' : 'turn ON';

    Alert.alert(
      'Confirm',
      `Are you sure you want to ${action} access for ${viewerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await ApiService.toggleViewerAccess(token, grantId);
              loadViewers();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  const handleContactSelect = (contact) => {
    const { email: contactEmail, phone: contactPhone } = contact;

    // Auto-fill based on what's available
    if (method === 'email' && contactEmail) {
      setEmail(contactEmail);
    } else if (method === 'sms' && contactPhone) {
      setPhone(contactPhone);
    } else {
      // If current method doesn't match available contact info, switch method
      if (contactEmail) {
        setMethod('email');
        setEmail(contactEmail);
      } else if (contactPhone) {
        setMethod('sms');
        setPhone(contactPhone);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Loved Ones Access</Text>
      <Text style={styles.subtitle}>
        Invite loved ones to view your stories and ask questions
      </Text>

      {/* Invite Section */}
      <View style={styles.inviteSection}>
        <Text style={styles.sectionTitle}>Send Invitation</Text>

        {/* Method Selector */}
        <View style={styles.methodSelector}>
          <TouchableOpacity
            style={[
              styles.methodButton,
              method === 'email' && styles.methodButtonActive
            ]}
            onPress={() => setMethod('email')}
          >
            <Text style={[
              styles.methodButtonText,
              method === 'email' && styles.methodButtonTextActive
            ]}>
              Email
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.methodButton,
              method === 'sms' && styles.methodButtonActive
            ]}
            onPress={() => setMethod('sms')}
          >
            <Text style={[
              styles.methodButtonText,
              method === 'sms' && styles.methodButtonTextActive
            ]}>
              Text Message
            </Text>
          </TouchableOpacity>
        </View>

        {/* Choose from Contacts Button */}
        <TouchableOpacity
          style={styles.contactsButton}
          onPress={() => setShowContactPicker(true)}
        >
          <Text style={styles.contactsButtonText}>
            👥 Choose from Contacts
          </Text>
        </TouchableOpacity>

        <Text style={styles.orText}>or enter manually</Text>

        {/* Conditional Input Based on Method */}
        {method === 'email' ? (
          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Phone number (e.g., +1234567890)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        )}

        <TouchableOpacity
          style={[styles.sendButton, sending && styles.buttonDisabled]}
          onPress={sendInvite}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>
              Send via {method === 'email' ? 'Email' : 'Text'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ContactPicker
        visible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelectContact={handleContactSelect}
        mode={method}
      />

      {/* Viewers List */}
      <View style={styles.viewersSection}>
        <Text style={styles.sectionTitle}>Who Has Access</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#e11d48" />
        ) : viewers.length === 0 ? (
          <Text style={styles.emptyText}>No loved ones yet</Text>
        ) : (
          viewers.map((viewer) => (
            <View key={viewer.grant_id} style={styles.viewerCard}>
              <View style={styles.viewerInfo}>
                <Text style={styles.viewerName}>{viewer.viewer_name}</Text>
                <Text style={styles.viewerEmail}>{viewer.viewer_email}</Text>
              </View>
              <Switch
                value={viewer.is_active}
                onValueChange={() =>
                  toggleAccess(viewer.grant_id, viewer.is_active, viewer.viewer_name)
                }
                trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                thumbColor={viewer.is_active ? '#e11d48' : '#f3f4f6'}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  backButton: {
    marginTop: 40,
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: '#e11d48',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  inviteSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  methodSelector: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  methodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  methodButtonActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  methodButtonTextActive: {
    color: '#e11d48',
  },
  contactsButton: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  contactsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  orText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  sendButton: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  viewersSection: {
    marginBottom: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 20,
  },
  viewerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 10,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  viewerEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
});
