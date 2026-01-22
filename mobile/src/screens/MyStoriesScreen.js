import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function MyStoriesScreen({ navigation }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getMyStories(token);
      setStories(data.stories);
    } catch (error) {
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
      year: 'numeric',
    });
  };

  const renderStory = ({ item }) => (
    <TouchableOpacity
      style={styles.storyCard}
      onPress={() => navigation.navigate('StoryDetail', { storyId: item.id })}
    >
      <View style={styles.storyHeader}>
        <Text style={styles.storyDate}>{formatDate(item.created_at)}</Text>
        {item.response_type && (
          <View style={[styles.badge, getBadgeStyle(item.response_type)]}>
            <Text style={styles.badgeText}>{item.response_type}</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.promptText} numberOfLines={2}>
        {item.prompt_text || item.question}
      </Text>
      
      <Text style={styles.responsePreview} numberOfLines={3}>
        {item.response_text}
      </Text>
    </TouchableOpacity>
  );

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'daily':
        return { backgroundColor: '#fef2f2' };
      case 'bonus':
        return { backgroundColor: '#f3e8ff' };
      case 'freewrite':
        return { backgroundColor: '#dcfce7' };
      default:
        return { backgroundColor: '#f3f4f6' };
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No Stories Yet</Text>
          <Text style={styles.emptyText}>Start writing your first story!</Text>
        </View>
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

      <Text style={styles.title}>My Stories</Text>
      <Text style={styles.subtitle}>{stories.length} stories written</Text>

      <FlatList
        data={stories}
        renderItem={renderStory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
      />
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
    marginBottom: 10,
  },
  backText: {
    color: '#e11d48',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  listContainer: {
    padding: 20,
  },
  storyCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  storyDate: {
    fontSize: 12,
    color: '#999',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
  },
  promptText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  responsePreview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
