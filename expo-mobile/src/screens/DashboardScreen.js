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
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';
import OwnerSwitcher from '../components/OwnerSwitcher';
import PushNotificationService from '../services/PushNotificationService';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import { useFontSize } from '../context/FontSizeContext';

export default function DashboardScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyPromptCompleted, setDailyPromptCompleted] = useState(false);
  const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0);

  // Viewer multi-owner support
  const [currentOwner, setCurrentOwner] = useState(null);
  const [showOwnerSwitcher, setShowOwnerSwitcher] = useState(false);

  // Notification permission modal
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  useEffect(() => {
    loadUserData();
    loadPendingQuestions();
    loadCurrentOwner();
  }, []);

  // Check for first visit after loading is complete and user is loaded
  useEffect(() => {
    console.log('📊 Loading state:', loading, 'User loaded:', !!user);
    if (!loading && user) {
      console.log('📊 Dashboard finished loading, checking first visit...');
      checkFirstVisit();
    }
  }, [loading, user]);

  const checkFirstVisit = async () => {
    console.log('🔔 checkFirstVisit: Starting...');

    if (!user || !user.id) {
      console.log('⚠️ User not loaded yet, skipping notification check');
      return;
    }

    try {
      // Make the key user-specific so each account gets asked
      const storageKey = `notificationPermissionAsked_${user.id}`;
      const hasAskedForNotifications = await AsyncStorage.getItem(storageKey);
      console.log('🔔 Notification permission asked before?', hasAskedForNotifications);
      console.log('🔔 Storage key:', storageKey);

      if (!hasAskedForNotifications) {
        console.log('🔔 Will show notification modal in 1 second...');
        // Show modal after a short delay to let dashboard load
        setTimeout(() => {
          console.log('🔔 Timeout fired! Setting showNotificationModal to TRUE');
          setShowNotificationModal(true);
          console.log('🔔 setShowNotificationModal(true) called');
        }, 1000);
      } else {
        console.log('🔔 User already made choice, initializing push notifications');
        // If they already made a choice, initialize notifications
        initializePushNotifications();
      }
    } catch (error) {
      console.error('❌ Failed to check first visit:', error);
    }
  };

  const initializePushNotifications = async () => {
    try {
      // Initialize push notifications
      await PushNotificationService.initialize();
      console.log('✅ Push notifications initialized');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  };

  const handleAcceptNotifications = async () => {
    console.log('✅ User accepted notifications');
    setShowNotificationModal(false);

    if (user && user.id) {
      // Use user-specific storage key
      await AsyncStorage.setItem(`notificationPermissionAsked_${user.id}`, 'true');
    }

    try {
      const token = await AsyncStorage.getItem('authToken');
      // Enable all notifications in backend
      await ApiService.updateNotificationPreferences(token, {
        notifications_enabled: true,
      });

      // Initialize push notifications and request permission
      await initializePushNotifications();

      // Note: Alert temporarily disabled until native rebuild
      console.log('✅ Notification preferences saved (native push will work after app rebuild)');
      /*
      Alert.alert(
        'Notifications Enabled',
        'You\'ll now receive helpful reminders and updates!'
      );
      */
    } catch (error) {
      console.error('❌ Failed to enable notifications:', error);
      // Don't show error to user during temp state
      // Alert.alert('Error', 'Failed to enable notifications. You can enable them later in settings.');
    }
  };

  const handleDeclineNotifications = async () => {
    console.log('❌ User declined notifications');
    setShowNotificationModal(false);

    if (user && user.id) {
      // Use user-specific storage key
      await AsyncStorage.setItem(`notificationPermissionAsked_${user.id}`, 'true');
    }

    try {
      const token = await AsyncStorage.getItem('authToken');
      // Disable notifications in backend
      await ApiService.updateNotificationPreferences(token, {
        notifications_enabled: false,
      });
    } catch (error) {
      console.error('❌ Failed to save notification preference:', error);
    }
  };

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
      loadPendingQuestions();
      loadCurrentOwner();
    }, [])
  );

  const loadUserData = async () => {
    console.log('📊 loadUserData: Starting...');
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('user');
      const statsData = await ApiService.getUserStats(token);

      const parsedUser = JSON.parse(userData);
      console.log('📊 loadUserData: User loaded -', parsedUser?.email, 'role:', parsedUser?.role);
      setUser(parsedUser);
      setStats(statsData.stats);

      // Only check daily prompt status for owner accounts
      if (parsedUser?.role === 'owner') {
        console.log('📊 loadUserData: Checking daily prompt status...');
        await checkDailyPromptStatus(); // Wait for this to complete
      }
      console.log('📊 loadUserData: Complete, setting loading to false');
    } catch (error) {
      console.error('❌ loadUserData error:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      console.log('📊 loadUserData: Finally block - loading set to false');
    }
  };

  const checkDailyPromptStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getTodayPrompt(token);

      // Check if today's daily prompt has been answered
      setDailyPromptCompleted(data.alreadyAnswered || data.answered || data.promptAnswered || false);
    } catch (error) {
      console.error('Failed to check daily prompt status:', error);
    }
  };

  const loadPendingQuestions = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getPendingQuestionsCount(token);
      setPendingQuestionsCount(data.count || 0);
    } catch (error) {
      console.error('Failed to load pending questions:', error);
    }
  };

  const loadCurrentOwner = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      const parsedUser = JSON.parse(userData);

      // Only load owner info if user is a viewer
      if (parsedUser?.role === 'viewer') {
        const currentOwnerId = await AsyncStorage.getItem('currentOwnerId');

        if (currentOwnerId) {
          const token = await AsyncStorage.getItem('authToken');
          const data = await ApiService.getMyOwners(token);
          const owner = data.owners.find(o => o.owner_id === currentOwnerId);
          setCurrentOwner(owner);
        }
      }
    } catch (error) {
      console.error('Failed to load current owner:', error);
    }
  };

  const handleOwnerSelect = async (ownerId) => {
    // Reload data for the newly selected owner
    await loadCurrentOwner();
    // Refresh all data (loadUserData will handle prompt check if user is owner)
    await loadUserData();
  };

  const handleAnswerPrompt = () => {
    if (dailyPromptCompleted) {
      // Load next weighted prompt
      navigation.navigate('DailyPrompt', { mode: 'another' });
    } else {
      // Load today's daily prompt
      navigation.navigate('DailyPrompt', { mode: 'daily' });
    }
  };

  if (loading) {
    return (
      <>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e11d48" />
        </View>

        {/* Render modal even during loading */}
        <NotificationPermissionModal
          visible={showNotificationModal}
          onAccept={handleAcceptNotifications}
          onDecline={handleDeclineNotifications}
        />
      </>
    );
  }

  const isViewer = user?.role === 'viewer';

  return (
    <View style={styles.container}>
      <Text style={[styles.welcome, { fontSize: getFontSize(24) }]}>Welcome back, {user?.fullName?.split(' ')[0]}! 👋</Text>

      {/* Owner Switcher for Viewers */}
      {isViewer && (
        <TouchableOpacity
          style={styles.ownerSwitcherButton}
          onPress={() => setShowOwnerSwitcher(true)}
        >
          <Text style={[styles.ownerSwitcherLabel, { fontSize: getFontSize(12) }]}>Viewing stories from:</Text>
          <Text style={[styles.ownerSwitcherName, { fontSize: getFontSize(16) }]}>
            {currentOwner ? currentOwner.owner_name : 'Select Owner'} ▼
          </Text>
        </TouchableOpacity>
      )}

      {/* Owner Stats - Only show for owners */}
      {!isViewer && (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { fontSize: getFontSize(32) }]}>{stats?.currentStreak || 0}</Text>
          <Text style={[styles.statLabel, { fontSize: getFontSize(14) }]}>Day Streak 🔥</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { fontSize: getFontSize(32) }]}>{stats?.totalResponses || 0}</Text>
          <Text style={[styles.statLabel, { fontSize: getFontSize(14) }]}>Stories 📖</Text>
        </View>
      </View>
      )}

      {/* Loved Ones Questions Card - Only show for owners */}
      {!isViewer && pendingQuestionsCount > 0 && (
        <TouchableOpacity
          style={styles.familyQuestionsCard}
          onPress={() => navigation.navigate('FamilyQuestions')}
        >
          <Text style={[styles.familyQuestionsTitle, { fontSize: getFontSize(16) }]}>
            📬 Questions from Loved Ones ({pendingQuestionsCount})
          </Text>
          <Text style={[styles.familyQuestionsSubtitle, { fontSize: getFontSize(14) }]}>
            Your loved ones have submitted questions for you to answer
          </Text>
        </TouchableOpacity>
      )}

      {/* Owner-specific buttons */}
      {!isViewer && (
        <>
          <TouchableOpacity
            style={styles.promptButton}
            onPress={handleAnswerPrompt}
          >
            <Text style={[styles.promptButtonText, { fontSize: getFontSize(16) }]}>
              {dailyPromptCompleted ? '📝 Answer Another Prompt' : '📝 Answer Today\'s Prompt'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.freeWriteButton}
            onPress={() => navigation.navigate('FreeWrite')}
          >
            <Text style={[styles.freeWriteButtonText, { fontSize: getFontSize(16) }]}>✍️ Create a Story</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Viewer-specific buttons */}
      {isViewer && !currentOwner && (
        <View style={styles.noOwnerCard}>
          <Text style={[styles.noOwnerTitle, { fontSize: getFontSize(20) }]}>👋 Welcome!</Text>
          <Text style={[styles.noOwnerText, { fontSize: getFontSize(14) }]}>
            To get started, you'll need to accept an invite from the person whose stories you want to view.
          </Text>
          <TouchableOpacity
            style={styles.acceptInviteButton}
            onPress={() => navigation.navigate('AcceptInvite')}
          >
            <Text style={[styles.acceptInviteButtonText, { fontSize: getFontSize(16) }]}>✉️ Accept Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      {isViewer && currentOwner && (
        <TouchableOpacity
          style={styles.promptButton}
          onPress={() => navigation.navigate('SubmitQuestion', {
            ownerId: currentOwner?.owner_id,
            ownerName: currentOwner?.owner_name
          })}
        >
          <Text style={[styles.promptButtonText, { fontSize: getFontSize(16) }]}>💬 Submit a Question</Text>
        </TouchableOpacity>
      )}

      {/* Shared buttons */}
      <TouchableOpacity
        style={styles.storiesButton}
        onPress={() => navigation.navigate('MyStories')}
      >
        <Text style={[styles.storiesButtonText, { fontSize: getFontSize(16) }]}>
          📖 {isViewer ? `${currentOwner?.owner_name || 'Owner'}'s Stories` : `My Stories (${stats?.totalResponses || 0})`}
        </Text>
      </TouchableOpacity>

      {/* AI Persona temporarily disabled - invalid API key */}
      {/* <TouchableOpacity
        style={styles.aiButton}
        onPress={() => navigation.navigate('AIChat')}
      >
        <Text style={[styles.aiButtonText, { fontSize: getFontSize(16) }]}>🤖 Chat with AI Persona</Text>
      </TouchableOpacity> */}

      <TouchableOpacity
        style={styles.accountButton}
        onPress={() => navigation.navigate('Account')}
      >
        <Text style={[styles.accountButtonText, { fontSize: getFontSize(16) }]}>⚙️ Account Settings</Text>
      </TouchableOpacity>

      {/* Owner Switcher Modal */}
      <OwnerSwitcher
        visible={showOwnerSwitcher}
        onClose={() => setShowOwnerSwitcher(false)}
        onSelectOwner={handleOwnerSelect}
      />

      {/* Notification Permission Modal */}
      <NotificationPermissionModal
        visible={showNotificationModal}
        onAccept={handleAcceptNotifications}
        onDecline={handleDeclineNotifications}
      />
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
    marginBottom: 20,
  },
  ownerSwitcherButton: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  ownerSwitcherLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  ownerSwitcherName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
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
  familyQuestionsCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#f59e0b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  familyQuestionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  familyQuestionsSubtitle: {
    fontSize: 14,
    color: '#78350f',
  },
  noOwnerCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    padding: 24,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  noOwnerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111',
  },
  noOwnerText: {
    fontSize: 15,
    color: '#1e40af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  acceptInviteButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  acceptInviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  freeWriteButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#10b981',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  freeWriteButtonText: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: 'bold',
  },
  accountButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#64748b',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  accountButtonText: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: 'bold',
  },
});