import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function AccountScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [accessGrants, setAccessGrants] = useState([]);
  const [submittedQuestions, setSubmittedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccountData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAccountData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadAccountData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('user');
      const accountData = await ApiService.getUserAccount(token);
      const grants = await ApiService.getAccessGrants(token);
      const questions = await ApiService.getSubmittedQuestions(token);

      setUser(JSON.parse(userData));
      setAccount(accountData.account);
      setAccessGrants(grants.grants || []);
      setSubmittedQuestions(questions.questions || []);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            navigation.replace('Login');
          },
        },
      ]
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
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Account Settings</Text>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{account?.full_name || 'Not set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{account?.email}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.label}>Birth Location</Text>
            <Text style={styles.value}>{account?.birth_location || 'Not set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.label}>Timezone</Text>
            <Text style={styles.value}>{account?.timezone || 'Not set'}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Family & Friends Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Family & Friends</Text>
          <Text style={styles.sectionCount}>{accessGrants.length}</Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('ManageFamily')}
        >
          <Text style={styles.cardTitle}>Manage Access</Text>
          <Text style={styles.cardSubtitle}>
            Control who can view your stories and submit questions
          </Text>
          <Text style={styles.cardLink}>View all →</Text>
        </TouchableOpacity>
      </View>

      {/* Submitted Questions Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Questions from Family</Text>
          <Text style={styles.sectionCount}>
            {submittedQuestions.filter(q => q.status === 'pending').length}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Questions')}
        >
          <Text style={styles.cardTitle}>View Questions</Text>
          <Text style={styles.cardSubtitle}>
            Questions will appear as daily prompts
          </Text>
          <Text style={styles.cardLink}>View all →</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
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
    marginBottom: 20,
    marginHorizontal: 20,
    color: '#111',
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  sectionCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 15,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: '#e11d48',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  cardLink: {
    fontSize: 14,
    color: '#e11d48',
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e11d48',
    alignItems: 'center',
    marginTop: 20,
  },
  logoutText: {
    color: '#e11d48',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 40,
  },
});
