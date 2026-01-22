import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function StoryDetailScreen({ route, navigation }) {
  const { storyId } = route.params;
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStory();
  }, []);

  const loadStory = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getStoryDetail(token, storyId);
      setStory(data.story);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.centered}>
        <Text>Story not found</Text>
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

      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(story.created_at)}</Text>
        {story.response_type && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{story.response_type}</Text>
          </View>
        )}
      </View>

      <View style={styles.promptCard}>
        <Text style={styles.promptLabel}>Prompt</Text>
        <Text style={styles.promptText}>
          {story.prompt_text || story.question}
        </Text>
      </View>

      <View style={styles.storyCard}>
        <Text style={styles.storyLabel}>Your Story</Text>
        <Text style={styles.storyText}>{story.response_text}</Text>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  badge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e11d48',
    textTransform: 'uppercase',
  },
  promptCard: {
    backgroundColor: '#fef2f2',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e11d48',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  promptText: {
    fontSize: 16,
    color: '#111',
    lineHeight: 24,
  },
  storyCard: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  storyLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  storyText: {
    fontSize: 16,
    color: '#111',
    lineHeight: 24,
  },
  spacer: {
    height: 40,
  },
});
