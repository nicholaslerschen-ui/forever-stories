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

export default function InviteFamilyScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState({
    viewStories: true,
    chatWithAI: false,
    submitQuestions: false,
  });
  const [loading, setLoading] = useState(false);

  const togglePermission = (key) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSendInvite = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!permissions.viewStories && !permissions.chatWithAI && !permissions.submitQuestions) {
      Alert.alert('Error', 'Please select at least one permission');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.sendInvitation(token, email, permissions);

      Alert.alert('Success!', 'Invitation sent successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
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

      <Text style={styles.title}>Invite Family or Friend</Text>
      <Text style={styles.subtitle}>
        They'll be able to access your stories based on the permissions you grant
      </Text>

      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="their.email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.sectionTitle}>Permissions</Text>
      <Text style={styles.sectionSubtitle}>
        Choose what they can do with your account
      </Text>

      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => togglePermission('viewStories')}
      >
        <Text style={styles.checkboxIcon}>
          {permissions.viewStories ? '☑️' : '⬜'}
        </Text>
        <View style={styles.checkboxContent}>
          <Text style={styles.checkboxLabel}>View Stories</Text>
          <Text style={styles.checkboxDescription}>
            Can read all your written stories and responses
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => togglePermission('chatWithAI')}
      >
        <Text style={styles.checkboxIcon}>
          {permissions.chatWithAI ? '☑️' : '⬜'}
        </Text>
        <View style={styles.checkboxContent}>
          <Text style={styles.checkboxLabel}>Chat with AI Persona</Text>
          <Text style={styles.checkboxDescription}>
            Can chat with AI as if they're talking to you
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => togglePermission('submitQuestions')}
      >
        <Text style={styles.checkboxIcon}>
          {permissions.submitQuestions ? '☑️' : '⬜'}
        </Text>
        <View style={styles.checkboxContent}>
          <Text style={styles.checkboxLabel}>Submit Questions</Text>
          <Text style={styles.checkboxDescription}>
            Can submit questions that become your daily prompts
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.sendButton, loading && styles.buttonDisabled]}
        onPress={handleSendInvite}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.sendButtonText}>Send Invitation</Text>
        )}
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
    marginBottom: 5,
    marginHorizontal: 20,
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    marginHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginHorizontal: 20,
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    marginHorizontal: 20,
    color: '#111',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  checkboxIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  checkboxDescription: {
    fontSize: 13,
    color: '#666',
  },
  sendButton: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 30,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 40,
  },
});
