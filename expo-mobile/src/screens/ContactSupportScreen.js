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
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useFontSize } from '../context/FontSizeContext';

export default function ContactSupportScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const result = await ApiService.sendSupportMessage(token, subject.trim(), message.trim());

      Alert.alert(
        'Message Sent',
        result.message || "We'll get back to you soon!",
        [{ text: 'OK', onPress: () => navigation.goBack() }]
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
          <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { fontSize: getFontSize(28) }]}>Contact Support</Text>
        <Text style={[styles.subtitle, { fontSize: getFontSize(14) }]}>
          Send us a message and we'll get back to you as soon as possible.
        </Text>

        <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Subject</Text>
        <TextInput
          style={[styles.input, { fontSize: getFontSize(16) }]}
          placeholder="What do you need help with?"
          value={subject}
          onChangeText={setSubject}
          maxLength={200}
        />

        <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Message</Text>
        <TextInput
          style={[styles.textArea, { fontSize: getFontSize(16) }]}
          placeholder="Describe your issue or question..."
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
          maxLength={5000}
        />
        <Text style={[styles.charCount, { fontSize: getFontSize(12) }]}>
          {message.length}/5000
        </Text>

        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.sendButtonText, { fontSize: getFontSize(16) }]}>
              Send Message
            </Text>
          )}
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
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    marginTop: 50,
    marginBottom: 20,
  },
  backText: {
    color: '#e11d48',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111',
  },
  subtitle: {
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    minHeight: 160,
    marginBottom: 4,
  },
  charCount: {
    color: '#999',
    textAlign: 'right',
    marginBottom: 24,
  },
  sendButton: {
    backgroundColor: '#e11d48',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
