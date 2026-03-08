import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useFontSize } from '../context/FontSizeContext';

export default function FollowUpQuestionsModal({
  visible,
  promptQuestion,
  userResponse,
  responseId,
  promptId,
  onComplete,
}) {
  const { getFontSize } = useFontSize();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);

  useEffect(() => {
    if (visible) {
      generateQuestions();
    }
  }, [visible]);

  const generateQuestions = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const result = await ApiService.generateFollowUpQuestions(
        token,
        promptQuestion,
        userResponse
      );
      if (result && result.followUpQuestions) {
        setQuestions(result.followUpQuestions);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to generate follow-ups:', error);
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.submitFollowUpResponse(
        token,
        promptId,
        answer.trim(),
        responseId
      );
      setAnsweredCount(prev => prev + 1);
      setAnswer('');

      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to submit follow-up:', error);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setAnswer('');
    } else {
      onComplete();
    }
  };

  const handleSkipAll = () => {
    onComplete();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e11d48" />
              <Text style={[styles.loadingText, { fontSize: getFontSize(16) }]}>
                Generating follow-up questions...
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Follow-up</Text>
                </View>
                <Text style={[styles.counter, { fontSize: getFontSize(13) }]}>
                  {currentIndex + 1} of {questions.length}
                </Text>
              </View>

              <Text style={[styles.title, { fontSize: getFontSize(20) }]}>
                Want to add more detail?
              </Text>

              <Text style={[styles.subtitle, { fontSize: getFontSize(14) }]}>
                These questions can help capture richer memories. Answer as many as you'd like.
              </Text>

              <View style={styles.questionCard}>
                <Text style={[styles.questionText, { fontSize: getFontSize(17) }]}>
                  {questions[currentIndex]}
                </Text>
              </View>

              <TextInput
                style={[styles.textarea, { fontSize: getFontSize(16) }]}
                placeholder="Share more details..."
                value={answer}
                onChangeText={setAnswer}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoCapitalize="sentences"
                autoCorrect={true}
                spellCheck={true}
              />

              <TouchableOpacity
                style={[styles.submitButton, (!answer.trim() || submitting) && styles.submitButtonDisabled]}
                onPress={handleSubmitAnswer}
                disabled={!answer.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.submitButtonText, { fontSize: getFontSize(16) }]}>
                    Save & Continue
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={handleSkipQuestion}>
                <Text style={[styles.skipButtonText, { fontSize: getFontSize(14) }]}>
                  {currentIndex < questions.length - 1 ? 'Skip this question' : 'Skip & finish'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipAllButton} onPress={handleSkipAll}>
                <Text style={[styles.skipAllButtonText, { fontSize: getFontSize(13) }]}>
                  Done with follow-ups
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#e11d48',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  counter: {
    color: '#999',
  },
  title: {
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  questionCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#e11d48',
    marginBottom: 16,
  },
  questionText: {
    color: '#333',
    lineHeight: 24,
    fontWeight: '500',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    marginBottom: 16,
    color: '#111',
  },
  submitButton: {
    backgroundColor: '#e11d48',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    color: '#e11d48',
  },
  skipAllButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  skipAllButtonText: {
    color: '#999',
  },
});
