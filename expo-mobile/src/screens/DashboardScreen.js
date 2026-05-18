import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/api';
import OwnerSwitcher from '../components/OwnerSwitcher';
import PushNotificationService from '../services/PushNotificationService';
import NotificationPermissionModal from '../components/NotificationPermissionModal';
import { useFontSize } from '../context/FontSizeContext';
import { colors, shadows } from '../styles/colors';

export default function DashboardScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyPromptCompleted, setDailyPromptCompleted] = useState(false);
  const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0);

  // Viewer multi-owner support
  const [currentOwner, setCurrentOwner] = useState(null);
  const [currentOwnerId, setCurrentOwnerId] = useState(null);
  const [showOwnerSwitcher, setShowOwnerSwitcher] = useState(false);

  // Notification permission modal
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Dismissable banners
  const [limitBadgeDismissed, setLimitBadgeDismissed] = useState(false);
  const [viewerPremiumDismissed, setViewerPremiumDismissed] = useState(false);

  // Prompt and response state
  const [prompt, setPrompt] = useState(null);
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isWriting, setIsWriting] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadUserData();
    loadPendingQuestions();
    loadCurrentOwner();
    loadDailyPrompt();
  }, []);

  // Fade in animation when screen loads
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  // Check for first visit after loading is complete and user is loaded
  useEffect(() => {
    if (!loading && user) {
      checkFirstVisit();
    }
  }, [loading, user]);

  const checkFirstVisit = async () => {

    if (!user || !user.id) {
      return;
    }

    try {
      // Make the key user-specific so each account gets asked
      const storageKey = `notificationPermissionAsked_${user.id}`;
      const hasAskedForNotifications = await AsyncStorage.getItem(storageKey);

      if (!hasAskedForNotifications) {
        // Show modal after a short delay to let dashboard load
        setTimeout(() => {
          setShowNotificationModal(true);
        }, 1000);
      } else {
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
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  };

  const handleAcceptNotifications = async () => {
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
      // Don't reload prompt here - preserve current prompt state
      // Initial load happens in useEffect, and new prompts load after submission
      setResponse(''); // Clear response when returning to dashboard
    }, [])
  );

  const loadUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('user');
      const statsData = await ApiService.getUserStats(token);

      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setStats(statsData.stats);

      // Check daily prompt status when in writer mode
      const storedOwnerId = await AsyncStorage.getItem('currentOwnerId');
      // For viewer-role users with no stored preference, they'll default to viewer mode
      const isViewerRole = parsedUser?.role === 'viewer';
      const writerMode = storedOwnerId === 'myself' || (!storedOwnerId && !isViewerRole);
      if (writerMode) {
        await checkDailyPromptStatus(); // Wait for this to complete
      }
    } catch (error) {
      console.error('❌ loadUserData error:', error);
      // If token is missing or invalid, redirect to login
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        navigation.replace('Login');
        return;
      }
      // Still load local user data even if stats API fails
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) setUser(JSON.parse(userData));
      } catch (_) {}
    } finally {
      setLoading(false);
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
      const storedOwnerId = await AsyncStorage.getItem('currentOwnerId');

      if (storedOwnerId === 'myself') {
        // Explicitly chose writer mode
        setCurrentOwnerId('myself');
        setCurrentOwner(null);
        return;
      }

      if (storedOwnerId) {
        // Explicitly chose a specific owner — load their info
        const token = await AsyncStorage.getItem('authToken');
        const data = await ApiService.getMyOwners(token);
        const owner = data.owners.find(o => o.owner_id === storedOwnerId);
        if (owner) {
          setCurrentOwnerId(storedOwnerId);
          setCurrentOwner(owner);
          return;
        }
        // Stale owner ID from a previous session — clear it and fall through to default
        await AsyncStorage.removeItem('currentOwnerId');
      }

      // No stored preference (first load) — default based on signup role
      const userData = await AsyncStorage.getItem('user');
      const parsedUser = JSON.parse(userData);

      if (parsedUser?.role === 'viewer') {
        // Viewer signup: default to first connected owner
        try {
          const token = await AsyncStorage.getItem('authToken');
          const data = await ApiService.getMyOwners(token);
          if (data.owners && data.owners.length > 0) {
            const firstOwner = data.owners[0];
            await AsyncStorage.setItem('currentOwnerId', firstOwner.owner_id);
            setCurrentOwnerId(firstOwner.owner_id);
            setCurrentOwner(firstOwner);
            return;
          }
        } catch (err) {
          console.error('Failed to load owners for viewer default:', err);
        }
      }

      // Owner signup or viewer with no connections: default to writer mode
      setCurrentOwnerId(null);
      setCurrentOwner(null);
    } catch (error) {
      console.error('Failed to load current owner:', error);
    }
  };

  const loadDailyPrompt = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('user');
      const parsedUser = JSON.parse(userData);
      const storedOwnerId = await AsyncStorage.getItem('currentOwnerId');

      // Load prompts when in writer mode (not viewing someone else)
      // Viewer-role users with no stored preference will default to viewer mode
      const isViewerRole = parsedUser?.role === 'viewer';
      const shouldLoadPrompt = storedOwnerId === 'myself' || (!storedOwnerId && !isViewerRole);

      if (shouldLoadPrompt) {
        const data = await ApiService.getTodayPrompt(token);

        if (data.prompt) {
          setPrompt(data.prompt);
          setDailyPromptCompleted(data.alreadyAnswered || data.answered || data.promptAnswered || false);
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error('❌ Failed to load daily prompt:', error);
    }
  };

  const handleOwnerSelect = async (ownerId) => {
    // Reset dismissable banners when switching accounts
    setLimitBadgeDismissed(false);
    setViewerPremiumDismissed(false);

    // Reload data for the newly selected owner
    await loadCurrentOwner();
    // Refresh all data (loadUserData will handle prompt check if user is owner)
    await loadUserData();
    await loadDailyPrompt();
  };

  const submitResponse = async () => {
    if (!response.trim()) {
      Alert.alert('Error', 'Please write something before submitting');
      return;
    }

    if (!prompt) {
      Alert.alert('Error', 'No prompt loaded');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.submitPromptResponse(
        token,
        prompt.id,
        response,
        prompt.submittedQuestionId || null,
        null
      );

      // Clear response and load NEXT weighted prompt
      setResponse('');
      await loadUserData();

      // Load next weighted prompt instead of today's prompt
      const data = await ApiService.getNextWeightedPrompt(token);
      if (data.prompt) {
        setPrompt(data.prompt);
        setDailyPromptCompleted(true);
      }

      Alert.alert('Success', 'Your story has been saved! Here\'s another prompt for you.');
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', error.message || 'Failed to save your story');
    } finally {
      setSubmitting(false);
    }
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

  // Writer mode: explicitly chose 'myself', or owner-role with no selection yet
  const isInWriterMode = currentOwnerId === 'myself' || (!currentOwnerId && user?.role !== 'viewer');
  // Viewer mode: browsing someone else's stories, or viewer-role with no selection yet
  const isViewer = !isInWriterMode;

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Overlay for readability */}
        <View style={styles.overlay} />

        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Header with Logo and Subtitle */}
          <View style={styles.header}>
            <Text style={[styles.logo, { fontSize: getFontSize(40) }]}>Forever Stories</Text>
            <Text style={[styles.logoSubtitle, { fontSize: getFontSize(18) }]}>Preserve Your Legacy</Text>
          </View>

          {/* Pending Questions Badge */}
          {!isViewer && pendingQuestionsCount > 0 && (
            <TouchableOpacity
              style={styles.pendingBadge}
              onPress={() => navigation.navigate('FamilyQuestions')}
            >
              <Text style={[styles.pendingBadgeText, { fontSize: getFontSize(12) }]}>
                📬 {pendingQuestionsCount} question{pendingQuestionsCount > 1 ? 's' : ''} from loved ones
              </Text>
            </TouchableOpacity>
          )}

          {/* Story Limit Warning (free users at 15+ stories) */}
          {!isViewer && stats?.totalResponses >= 15 && stats?.storyLimit && !limitBadgeDismissed && (
            <View style={styles.limitBadge}>
              <TouchableOpacity
                style={styles.badgeContent}
                onPress={() => navigation.navigate('Premium')}
              >
                <Text style={[styles.limitBadgeText, { fontSize: getFontSize(12), flex: 1 }]}>
                  {stats.totalResponses >= 20
                    ? `📦 You've used all ${stats.storyLimit} free stories — Upgrade to keep writing`
                    : `📦 ${stats.totalResponses} of ${stats.storyLimit} free stories used — Upgrade for unlimited`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLimitBadgeDismissed(true)} style={styles.badgeDismiss}>
                <Text style={styles.badgeDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Viewer Premium Nudge (when viewing a non-premium owner with stories) */}
          {isViewer && currentOwner && currentOwner.subscription_tier !== 'premium' && currentOwner.story_count >= 5 && !viewerPremiumDismissed && (
            <View style={styles.viewerPremiumBadge}>
              <TouchableOpacity
                style={styles.badgeContent}
                onPress={() => navigation.navigate('Premium', {
                  giftForOwnerId: currentOwner.owner_id,
                  giftForOwnerName: currentOwner.owner_name,
                })}
              >
                <Text style={[styles.viewerPremiumBadgeText, { fontSize: getFontSize(12), flex: 1 }]}>
                  {currentOwner.story_count >= 20
                    ? `🎁 ${currentOwner.owner_name} has reached the free story limit — Gift Premium to unlock unlimited stories`
                    : currentOwner.story_count >= 15
                    ? `🎁 ${currentOwner.owner_name} has ${currentOwner.story_count}/20 free stories — Gift Premium for unlimited stories & AI features`
                    : `🎁 Gift Premium to ${currentOwner.owner_name} for richer stories with follow-up questions & AI Persona`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewerPremiumDismissed(true)} style={styles.badgeDismiss}>
                <Text style={styles.badgeDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Main Hero Content */}
          <View style={styles.heroContent}>
            <View style={styles.heroCard}>
              <Text style={[styles.heroDescription, { fontSize: getFontSize(16) }]}>
                {isViewer
                  ? "Browse cherished stories from your loved ones and help curate their legacy by asking thoughtful questions to inspire new stories."
                  : "Answer thoughtful prompts daily and create a beautiful collection of memories for your loved ones to cherish forever."}
              </Text>

              {!isViewer ? (
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={() => navigation.navigate('DailyPrompt', { mode: dailyPromptCompleted ? 'another' : 'daily' })}
                >
                  <Text style={[styles.ctaButtonText, { fontSize: getFontSize(18) }]}>
                    {dailyPromptCompleted ? '✍️ Answer Another Prompt' : '✨ Answer Today\'s Prompt'}
                  </Text>
                </TouchableOpacity>
              ) : !currentOwner ? (
                <View style={styles.viewerActions}>
                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => navigation.navigate('AcceptInvite')}
                  >
                    <Text style={[styles.ctaButtonText, { fontSize: getFontSize(18) }]}>
                      ✉️ Accept Invite
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('InviteParent', { fromDashboard: true })}
                  >
                    <Text style={[styles.secondaryButtonText, { fontSize: getFontSize(16) }]}>
                      Invite Someone to Write
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.viewerActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('MyStories')}
                  >
                    <Text style={[styles.secondaryButtonText, { fontSize: getFontSize(16) }]}>
                      📖 Browse Stories
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() =>
                      navigation.navigate('SubmitQuestion', {
                        ownerId: currentOwner?.owner_id,
                        ownerName: currentOwner?.owner_name,
                      })
                    }
                  >
                    <Text style={[styles.secondaryButtonText, { fontSize: getFontSize(16) }]}>
                      💬 Ask a Question
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() =>
                      navigation.navigate('AIChat', {
                        ownerId: currentOwner?.owner_id,
                        ownerName: currentOwner?.owner_name,
                      })
                    }
                  >
                    <Text style={[styles.secondaryButtonText, { fontSize: getFontSize(16) }]}>
                      🤖 Chat with AI Persona
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Bottom Icon Navigation */}
          <View style={styles.bottomNav}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setShowOwnerSwitcher(true)}
            >
              <View style={styles.navIconContainer}>
                <Text style={styles.navIcon}>👤</Text>
                {isInWriterMode && stats?.currentStreak > 0 && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{stats.currentStreak}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabel, { fontSize: getFontSize(11) }]} numberOfLines={1}>
                {isViewer && currentOwner ? currentOwner.owner_name : isViewer ? 'Select' : 'Myself'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('MyStories')}
            >
              <View style={styles.navIconContainer}>
                <Text style={styles.navIcon}>📖</Text>
                {!isViewer && stats?.totalResponses > 0 && (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeText}>{stats.totalResponses}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.navLabel, { fontSize: getFontSize(11) }]}>Stories</Text>
            </TouchableOpacity>

            {!isViewer && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigation.navigate('FreeWrite')}
              >
                <Text style={styles.navIcon}>✍️</Text>
                <Text style={[styles.navLabel, { fontSize: getFontSize(11) }]}>Create</Text>
              </TouchableOpacity>
            )}


            {isViewer && currentOwner && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => navigation.navigate('Questions')}
              >
                <Text style={styles.navIcon}>💬</Text>
                <Text style={[styles.navLabel, { fontSize: getFontSize(11) }]}>Questions</Text>
              </TouchableOpacity>
            )}

            {isViewer && currentOwner && (
              <TouchableOpacity
                style={styles.navButton}
                onPress={() =>
                  navigation.navigate('AIChat', {
                    ownerId: currentOwner.owner_id,
                    ownerName: currentOwner.owner_name,
                  })
                }
              >
                <Text style={styles.navIcon}>🤖</Text>
                <Text style={[styles.navLabel, { fontSize: getFontSize(11) }]}>AI Chat</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('Account')}
            >
              <Text style={styles.navIcon}>⚙️</Text>
              <Text style={[styles.navLabel, { fontSize: getFontSize(11) }]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ImageBackground>

      {/* Owner Switcher Modal */}
      <OwnerSwitcher
        visible={showOwnerSwitcher}
        onClose={() => setShowOwnerSwitcher(false)}
        onSelectOwner={handleOwnerSelect}
        onAcceptInvite={() => navigation.navigate('AcceptInvite')}
        onInviteWriter={() => navigation.navigate('InviteParent', { fromDashboard: true })}
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
    backgroundColor: colors.black,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gradientStart,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    alignItems: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 8,
  },
  logoSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  pendingBadge: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  limitBadge: {
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    borderWidth: 1,
    borderColor: '#e11d48',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  limitBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991b1b',
  },
  badgeContent: {
    flex: 1,
  },
  badgeDismiss: {
    paddingLeft: 10,
    paddingVertical: 4,
  },
  badgeDismissText: {
    color: 'rgba(0,0,0,0.4)',
    fontSize: 16,
    fontWeight: '600',
  },
  viewerPremiumBadge: {
    backgroundColor: 'rgba(254, 243, 199, 0.9)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
  },
  viewerPremiumBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroDescription: {
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  ctaButton: {
    backgroundColor: 'rgba(225, 29, 72, 0.85)',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...shadows.large,
  },
  ctaButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  viewerActions: {
    width: '100%',
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  navButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});