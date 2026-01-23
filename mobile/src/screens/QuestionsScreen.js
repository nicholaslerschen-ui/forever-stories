import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function QuestionsScreen({ navigation }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadQuestions();
    });
    return unsubscribe;
  }, [navigation]);

  const loadQuestions = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getSubmittedQuestions(token);
      setQuestions(data.questions || []);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId) => {
    Alert.alert(
      'Delete Question',
      'Are you sure you want to delete this question?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await ApiService.deleteQuestion(token, questionId);
              loadQuestions();
              Alert.alert('Success', 'Question deleted');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending':
        return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'used':
        return { backgroundColor: '#d1fae5', color: '#065f46' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151' };
    }
  };

  const renderQuestion = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.submitter}>
            From: {item.submitter_name || item.submitter_email}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.questionText}>{item.question_text}</Text>

        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>

        {item.status === 'pending' && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id)}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

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

      <Text style={styles.title}>Questions from Family</Text>
      <Text style={styles.subtitle}>
        Questions will appear as daily prompts in the order received
      </Text>

      {questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No questions yet</Text>
          <Text style={styles.emptySubtext}>
            When family members submit questions, they'll appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={questions}
          renderItem={renderQuestion}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  listContent: {
    paddingHorizontal: 20,
  },
  questionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  submitter: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 16,
    color: '#111',
    marginBottom: 10,
    lineHeight: 22,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc2626',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
