import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function EditAccessScreen({ route, navigation }) {
  const { grant } = route.params;

  const [permissions, setPermissions] = useState({
    viewStories: grant.permissions?.viewStories || false,
    chatWithAI: grant.permissions?.chatWithAI || false,
    submitQuestions: grant.permissions?.submitQuestions || false,
  });
  const [loading, setLoading] = useState(false);

  const togglePermission = (key) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleUpdatePermissions = async () => {
    if (!permissions.viewStories && !permissions.chatWithAI && !permissions.submitQuestions) {
      Alert.alert('Error', 'Please select at least one permission');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.updateAccessGrant(token, grant.id, permissions);

      Alert.alert('Success!', 'Permissions updated successfully', [
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

      <Text style={styles.title}>Edit Permissions</Text>

      <View style={styles.userInfo}>
        <Text style={styles.email}>{grant.recipient_email}</Text>
        {grant.recipient_name && (
          <Text style={styles.name}>{grant.recipient_name}</Text>
        )}
      </View>

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
        style={[styles.updateButton, loading && styles.buttonDisabled]}
        onPress={handleUpdatePermissions}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.updateButtonText}>Update Permissions</Text>
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
    marginBottom: 20,
    marginHorizontal: 20,
    color: '#111',
  },
  userInfo: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    color: '#666',
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
  updateButton: {
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
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 40,
  },
});
