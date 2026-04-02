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
import { useFontSize } from '../context/FontSizeContext';

export default function AccountScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [accessGrants, setAccessGrants] = useState([]);
  const [submittedQuestions, setSubmittedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

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
            // Remove auth token and user-specific session data
            // Preserve notification preferences (keyed by user ID)
            await AsyncStorage.multiRemove([
              'authToken',
              'user',
              'currentOwnerId',
              'onboardingComplete',
              'hasSeenShareModal',
              'premiumNudge5Shown',
              'premiumNudge15Shown',
            ]);
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete:\n\n• All your stories and memories\n• All photos and videos\n• All responses and data\n• Access for family members\n\nThis action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Final Confirmation',
      'Please confirm one more time that you want to permanently delete your account and all data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, Delete Everything',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const token = await AsyncStorage.getItem('authToken');
              await ApiService.deleteAccount(token);

              // Clear all local data
              await AsyncStorage.clear();

              Alert.alert(
                'Account Deleted',
                'Your account and all data have been permanently deleted.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate to login screen
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Login' }],
                      });
                    },
                  },
                ]
              );
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            } finally {
              setDeleting(false);
            }
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
        <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>Account Settings</Text>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Name</Text>
            <Text style={[styles.value, { fontSize: getFontSize(16) }]}>{account?.full_name || 'Not set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Email</Text>
            <Text style={[styles.value, { fontSize: getFontSize(16) }]}>{account?.email}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Birth Date</Text>
            <Text style={[styles.value, { fontSize: getFontSize(16) }]}>
              {account?.birth_date
                ? new Date(account.birth_date).toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric',
                  })
                : 'Not set'}
            </Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Birth Location</Text>
            <Text style={[styles.value, { fontSize: getFontSize(16) }]}>{account?.birth_location || 'Not set'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Timezone</Text>
            <Text style={[styles.value, { fontSize: getFontSize(16) }]}>{account?.timezone || 'Not set'}</Text>
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={[styles.editButtonText, { fontSize: getFontSize(16) }]}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loved Ones Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>Loved Ones</Text>
          {accessGrants.length > 0 && (
            <Text style={[styles.sectionCount, { fontSize: getFontSize(16) }]}>{accessGrants.length}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('FamilyAccess')}
        >
          <Text style={[styles.cardTitle, { fontSize: getFontSize(16) }]}>Invite Others</Text>
          <Text style={[styles.cardSubtitle, { fontSize: getFontSize(14) }]}>
            Invite loved ones to view your stories
          </Text>
          <Text style={[styles.cardLink, { fontSize: getFontSize(14) }]}>Send invite →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardSpacing]}
          onPress={() => navigation.navigate('AcceptInvite')}
        >
          <Text style={[styles.cardTitle, { fontSize: getFontSize(16) }]}>Accept Invite</Text>
          <Text style={[styles.cardSubtitle, { fontSize: getFontSize(14) }]}>
            Enter an invite code to view someone else's stories
          </Text>
          <Text style={[styles.cardLink, { fontSize: getFontSize(14) }]}>Enter code →</Text>
        </TouchableOpacity>
      </View>

      {/* Submitted Questions Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>Questions from Loved Ones</Text>
          {submittedQuestions.filter(q => q.status === 'pending').length > 0 && (
            <Text style={[styles.sectionCount, { fontSize: getFontSize(16) }]}>
              {submittedQuestions.filter(q => q.status === 'pending').length}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Questions')}
        >
          <Text style={[styles.cardTitle, { fontSize: getFontSize(16) }]}>View Questions</Text>
          <Text style={[styles.cardSubtitle, { fontSize: getFontSize(14) }]}>
            Questions will appear as daily prompts
          </Text>
          <Text style={[styles.cardLink, { fontSize: getFontSize(14) }]}>View all →</Text>
        </TouchableOpacity>
      </View>

      {/* Subscription Section */}
      {user?.role !== 'viewer' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>Subscription</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Premium')}
          >
            {account?.subscription_tier === 'premium' ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: '#e11d48', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginRight: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11, textTransform: 'uppercase' }}>Premium</Text>
                  </View>
                  <Text style={[styles.cardTitle, { fontSize: getFontSize(16) }]}>Active</Text>
                </View>
                <Text style={[styles.cardLink, { fontSize: getFontSize(14), marginTop: 8 }]}>Manage subscription →</Text>
              </>
            ) : (
              <>
                <Text style={[styles.cardTitle, { fontSize: getFontSize(16) }]}>Free Plan</Text>
                <Text style={[styles.cardSubtitle, { fontSize: getFontSize(14) }]}>
                  Upgrade to Premium for unlimited stories and AI Persona
                </Text>
                <Text style={[styles.cardLink, { fontSize: getFontSize(14) }]}>Upgrade →</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>Settings</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('NotificationSettings')}
        >
          <Text style={[styles.cardTitle, { fontSize: getFontSize(16) }]}>🔔 Notification Settings</Text>
          <Text style={[styles.cardSubtitle, { fontSize: getFontSize(14) }]}>
            Manage which notifications you receive
          </Text>
          <Text style={[styles.cardLink, { fontSize: getFontSize(14) }]}>Configure →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardSpacing]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={[styles.cardTitle, { fontSize: getFontSize(16) }]}>App Settings</Text>
          <Text style={[styles.cardSubtitle, { fontSize: getFontSize(14) }]}>
            Adjust text size and share the app
          </Text>
          <Text style={[styles.cardLink, { fontSize: getFontSize(14) }]}>Open settings →</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={[styles.logoutText, { fontSize: getFontSize(16) }]}>Logout</Text>
      </TouchableOpacity>

      {/* Delete Account Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDeleteAccount}
        disabled={deleting}
      >
        <Text style={[styles.deleteButtonText, { fontSize: getFontSize(13) }]}>
          Delete Account
        </Text>
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
  deleteButton: {
    marginHorizontal: 60,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  deleteButtonText: {
    color: '#999',
    fontSize: 13,
  },
  logoutButton: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e11d48',
    alignItems: 'center',
    marginTop: 15,
  },
  logoutText: {
    color: '#e11d48',
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 40,
  },
  cardSpacing: {
    marginTop: 15,
  },
});
