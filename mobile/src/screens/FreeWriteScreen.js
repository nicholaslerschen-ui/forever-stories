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

export default function FreeWriteScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitStory = async () => {
    if (!story.trim()) {
      Alert.alert('Error', 'Please write your story first');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.submitFreeWrite(token, title || 'Untitled Story', story);
      
      Alert.alert('Success!', 'Your story has been saved!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
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

      <Text style={styles.title}>Free Write</Text>
      <Text style={styles.subtitle}>Write about anything on your mind</Text>

      <Text style={styles.label}>Title (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Give your story a title..."
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Your Story</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Start writing your story..."
        value={story}
        onChangeText={setStory}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
      />

      <Text style={styles.charCount}>{story.length} characters</Text>

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={submitStory}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save Story</Text>
        )}
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
    marginBottom: 5,
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 200,
    marginBottom: 10,
  },
  charCount: {
    textAlign: 'right',
    color: '#999',
    fontSize: 12,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});