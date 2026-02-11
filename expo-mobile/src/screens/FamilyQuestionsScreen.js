import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';

export default function FamilyQuestionsScreen({ navigation }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadQuestions();
    }, [])
  );

  const loadQuestions = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getPendingQuestions(token);
      setQuestions(data.questions);
    } catch (error) {
      console.error('Load questions error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderQuestion = ({ item, index }) => (
    <TouchableOpacity
      style={styles.questionCard}
      onPress={() => navigation.navigate('DailyPrompt', { questionId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.questionHeader}>
        <Text style={styles.questionNumber}>Question #{index + 1}</Text>
        <Text style={styles.questionDate}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={styles.questionFrom}>From: {item.submitter_name || item.submitter_email}</Text>
      <Text style={styles.questionText}>{item.question_text}</Text>
      <View style={styles.answerPrompt}>
        <Text style={styles.answerPromptText}>Tap to answer →</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Questions from Loved Ones</Text>
      <Text style={styles.subtitle}>
        {questions.length === 0
          ? 'No pending questions right now'
          : `${questions.length} question${questions.length > 1 ? 's' : ''} waiting to be answered`}
      </Text>

      {questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No Questions Yet</Text>
          <Text style={styles.emptySubtitle}>
            When loved ones submit questions, they'll appear here and as daily prompts.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>
              Tap any question below to answer it. You can answer them in any order you like!
            </Text>
          </View>

          <FlatList
            data={questions}
            renderItem={renderQuestion}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  questionCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e11d48',
    textTransform: 'uppercase',
  },
  questionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  questionFrom: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
    marginBottom: 12,
  },
  answerPrompt: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  answerPromptText: {
    fontSize: 14,
    color: '#e11d48',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
