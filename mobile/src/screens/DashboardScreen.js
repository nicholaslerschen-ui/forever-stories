import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function DashboardScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('user');
      const statsData = await ApiService.getUserStats(token);
      
      setUser(JSON.parse(userData));
      setStats(statsData.stats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.replace('Login');
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
      <Text style={styles.welcome}>Welcome back, {user?.fullName?.split(' ')[0]}! 👋</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats?.currentStreak || 0}</Text>
          <Text style={styles.statLabel}>Day Streak 🔥</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats?.totalResponses || 0}</Text>
          <Text style={styles.statLabel}>Stories 📖</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.promptButton}
        onPress={() => navigation.navigate('DailyPrompt')}
      >
        <Text style={styles.promptButtonText}>📝 Answer Today's Prompt</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.storiesButton}
        onPress={() => navigation.navigate('MyStories')}
      >
        <Text style={styles.storiesButtonText}>📖 My Stories ({stats?.totalResponses || 0})</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.aiButton}
        onPress={() => navigation.navigate('AIChat')}
      >
        <Text style={styles.aiButtonText}>🤖 Chat with AI Persona</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
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
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 60,
    marginBottom: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fef2f2',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  promptButton: {
    backgroundColor: '#e11d48',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  promptButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  storiesButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e11d48',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  storiesButtonText: {
    color: '#e11d48',
    fontSize: 18,
    fontWeight: 'bold',
  },
  aiButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#9333ea',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  aiButtonText: {
    color: '#9333ea',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e11d48',
    alignItems: 'center',
  },
  logoutText: {
    color: '#e11d48',
    fontSize: 16,
    fontWeight: 'bold',
  },
});