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

export default function SubmitQuestionScreen({ route, navigation }) {
  const { ownerId, ownerName } = route.params;
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.submitQuestion(token, ownerId, question);

      Alert.alert('Success!', 'Your question has been submitted', [
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

      <Text style={styles.title}>Submit a Question</Text>
      <Text style={styles.subtitle}>
        Ask {ownerName} a question about their life story
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Your question will appear as a daily prompt for {ownerName} to answer
        </Text>
      </View>

      <Text style={styles.label}>Your Question</Text>
      <TextInput
        style={styles.questionInput}
        placeholder="What's a memory from your childhood that still makes you smile?"
        multiline
        numberOfLines={6}
        value={question}
        onChangeText={setQuestion}
        textAlignVertical="top"
      />

      <Text style={styles.charCount}>{question.length} characters</Text>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Question</Text>
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
    marginBottom: 20,
    marginHorizontal: 20,
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginHorizontal: 20,
    color: '#111',
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 150,
    marginHorizontal: 20,
  },
  charCount: {
    textAlign: 'right',
    color: '#999',
    fontSize: 12,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 40,
  },
});
