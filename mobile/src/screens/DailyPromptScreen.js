import React, { useState, useEffect } from 'react';
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

export default function DailyPromptScreen({ navigation }) {
  const [prompt, setPrompt] = useState(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    loadPrompt();
  }, []);

  const loadPrompt = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getTodayPrompt(token);
      
      if (data.alreadyAnswered || data.promptAnswered) {
        setAnswered(true);
      } else if (data.prompt) {
        setPrompt(data.prompt);
      } else {
        // No prompt available
        setAnswered(true);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!response.trim()) {
      Alert.alert('Error', 'Please write your story first');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      // Include submittedQuestionId if this is a question from family
      await ApiService.submitPromptResponse(
        token,
        prompt?.id || null,
        response,
        prompt?.submittedQuestionId || null
      );

      Alert.alert('Success!', 'Your story has been saved!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (answered || !prompt) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.centered}>
          <Text style={styles.title}>✅ All Done!</Text>
          <Text style={styles.message}>
            You've answered today's prompt. Come back tomorrow for a new one!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Today's Prompt</Text>

      {prompt?.type === 'submitted' && (
        <View style={styles.submittedBadge}>
          <Text style={styles.submittedBadgeText}>
            💝 Question from {prompt.submitterInfo?.name || 'Family'}
          </Text>
        </View>
      )}

      <View style={styles.promptCard}>
        <Text style={styles.category}>{prompt?.category || 'Personal'}</Text>
        <Text style={styles.promptText}>{prompt?.question}</Text>
      </View>

      <Text style={styles.label}>Your Story</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Share your memory or story..."
        value={response}
        onChangeText={setResponse}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
      />

      <Text style={styles.charCount}>{response.length} characters</Text>

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={submitResponse}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 20,
    color: '#111',
    textAlign: 'center',
  },
  submittedBadge: {
    backgroundColor: '#fce7f3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  submittedBadgeText: {
    color: '#9d174d',
    fontSize: 14,
    fontWeight: '600',
  },
  promptCard: {
    backgroundColor: '#fef2f2',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  category: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  promptText: {
    fontSize: 18,
    color: '#111',
    lineHeight: 26,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111',
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
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    paddingHorizontal: 40,
  },
});
