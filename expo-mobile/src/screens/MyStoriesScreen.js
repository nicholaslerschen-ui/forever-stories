import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SwipeListView } from 'react-native-swipe-list-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useFontSize } from '../context/FontSizeContext';
import { colors, shadows } from '../styles/colors';

export default function MyStoriesScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [currentOwner, setCurrentOwner] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedGateTag, setSelectedGateTag] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    loadUserAndOwner();
    loadStories();
  }, []);

  const loadUserAndOwner = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      const currentOwnerId = await AsyncStorage.getItem('currentOwnerId');
      if (currentOwnerId && currentOwnerId !== 'myself') {
        const token = await AsyncStorage.getItem('authToken');
        const data = await ApiService.getMyOwners(token);
        const owner = data.owners.find(o => o.owner_id === currentOwnerId);
        setCurrentOwner(owner);

        // Show one-time premium nudge alerts for viewers
        if (owner && owner.subscription_tier !== 'premium') {
          checkViewerPremiumNudge(owner);
        }
      }
    } catch (error) {
      console.error('Load user/owner error:', error);
    }
  };

  const checkViewerPremiumNudge = async (owner) => {
    try {
      const count = owner.story_count || 0;
      const name = owner.owner_name || 'your loved one';
      const ownerId = owner.owner_id;

      if (count >= 20) {
        const key = `viewerNudge20_${ownerId}`;
        const shown = await AsyncStorage.getItem(key);
        if (!shown) {
          await AsyncStorage.setItem(key, 'true');
          Alert.alert(
            'Story Limit Reached',
            `${name} has used all 20 free stories and can't write more. Gift them Premium for unlimited stories, follow-up questions, and AI Persona Chat!`,
            [
              { text: 'Maybe Later', style: 'cancel' },
              { text: 'Gift Premium', onPress: () => navigation.navigate('Premium', { giftForOwnerId: ownerId, giftForOwnerName: name }) }
            ]
          );
          return;
        }
      }

      if (count >= 15) {
        const key = `viewerNudge15_${ownerId}`;
        const shown = await AsyncStorage.getItem(key);
        if (!shown) {
          await AsyncStorage.setItem(key, 'true');
          Alert.alert(
            'Running Low on Stories',
            `${name} has written ${count} of 20 free stories. Gift them Premium so they can keep preserving memories with unlimited stories!`,
            [
              { text: 'Maybe Later', style: 'cancel' },
              { text: 'Gift Premium', onPress: () => navigation.navigate('Premium', { giftForOwnerId: ownerId, giftForOwnerName: name }) }
            ]
          );
          return;
        }
      }

      if (count >= 5) {
        const key = `viewerNudge5_${ownerId}`;
        const shown = await AsyncStorage.getItem(key);
        if (!shown) {
          await AsyncStorage.setItem(key, 'true');
          Alert.alert(
            'Help Capture Richer Stories',
            `${name} has ${count} stories! Gift them Premium to unlock follow-up questions that help capture deeper details and richer memories after each story.`,
            [
              { text: 'Maybe Later', style: 'cancel' },
              { text: 'Learn More', onPress: () => navigation.navigate('Premium', { giftForOwnerId: ownerId, giftForOwnerName: name }) }
            ]
          );
          return;
        }
      }
    } catch (error) {
      console.error('Viewer premium nudge error:', error);
    }
  };

  const loadStories = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const currentOwnerId = await AsyncStorage.getItem('currentOwnerId');
      const data = await ApiService.getMyStories(token, currentOwnerId);
      // Sort by newest first
      const sortedStories = data.stories.sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
      );
      setStories(sortedStories);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get unique domains from stories
  const domains = useMemo(() => {
    const uniqueDomains = [...new Set(stories.map(s => s.domain).filter(Boolean))];
    return ['all', ...uniqueDomains.sort()];
  }, [stories]);

  // Get unique gate tags from stories
  const gateTags = useMemo(() => {
    const uniqueGateTags = [...new Set(stories.map(s => s.gate_tag).filter(Boolean))];
    return ['all', ...uniqueGateTags.sort()];
  }, [stories]);

  // Format gate tag for display (snake_case → Title Case)
  const formatGateTag = (tag) => {
    if (tag === 'all') return 'All Stories';
    return tag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Filter stories based on search, domain, and gate tag
  const filteredStories = useMemo(() => {
    let filtered = stories;

    // Filter by domain
    if (selectedDomain !== 'all') {
      filtered = filtered.filter(s => s.domain === selectedDomain);
    }

    // Filter by gate tag
    if (selectedGateTag !== 'all') {
      filtered = filtered.filter(s => s.gate_tag === selectedGateTag);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const promptText = (s.prompt_text || '').toLowerCase();
        const responseText = (s.response_text || '').toLowerCase();
        const title = (s.title || '').toLowerCase();
        const question = (s.question || '').toLowerCase();

        return promptText.includes(query) ||
               responseText.includes(query) ||
               title.includes(query) ||
               question.includes(query);
      });
    }

    return filtered;
  }, [stories, selectedDomain, selectedGateTag, searchQuery]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async (storyId, storyTitle) => {
    Alert.alert(
      'Delete Story',
      `Are you sure you want to delete "${storyTitle || 'this story'}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await ApiService.deleteStory(token, storyId);

              // Remove from local state
              setStories(stories.filter(s => s.id !== storyId));

              Alert.alert('Success', 'Story deleted successfully');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete story');
            }
          },
        },
      ]
    );
  };

  const renderStory = ({ item }) => (
    <View style={styles.rowFront}>
      <TouchableOpacity
        style={styles.storyCard}
        onPress={() => navigation.navigate('StoryDetail', { storyId: item.id })}
      >
        <View style={styles.storyHeader}>
          <Text style={[styles.storyDate, { fontSize: getFontSize(12) }]}>{formatDate(item.created_at)}</Text>
          {item.response_type && (
            <View style={[styles.badge, getBadgeStyle(item.response_type)]}>
              <Text style={[styles.badgeText, { fontSize: getFontSize(10) }]}>{item.response_type}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.promptText, { fontSize: getFontSize(16) }]} numberOfLines={2}>
          {item.title || item.prompt_text || item.question || 'Untitled Story'}
        </Text>

        <Text style={[styles.responsePreview, { fontSize: getFontSize(14) }]} numberOfLines={3}>
          {item.response_text}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderHiddenItem = ({ item }) => (
    <View style={styles.rowBack}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id, item.title || item.prompt_text || 'this story')}
      >
        <Text style={styles.deleteIcon}>🗑️</Text>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
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
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.centered}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </LinearGradient>
    );
  }

  if (stories.length === 0) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.container}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { fontSize: getFontSize(24) }]}>No Stories Yet</Text>
          <Text style={[styles.emptyText, { fontSize: getFontSize(16) }]}>Start writing your first story!</Text>
        </View>
      </LinearGradient>
    );
  }

  // Empty state for filtered results
  const renderEmptyFiltered = () => (
    <View style={styles.emptyFilteredContainer}>
      <Text style={[styles.emptyTitle, { fontSize: getFontSize(20) }]}>No Stories Found</Text>
      <Text style={[styles.emptyText, { fontSize: getFontSize(14) }]}>
        Try adjusting your search or filters
      </Text>
      <TouchableOpacity
        style={styles.resetButton}
        onPress={() => {
          setSearchQuery('');
          setSelectedDomain('all');
          setSelectedGateTag('all');
        }}
      >
        <Text style={[styles.resetButtonText, { fontSize: getFontSize(14) }]}>Reset Filters</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>
        {currentOwner ? `${currentOwner.owner_name}'s Stories` : 'My Stories'}
      </Text>
      <Text style={[styles.subtitle, { fontSize: getFontSize(16) }]}>
        {filteredStories.length} {filteredStories.length === stories.length ? 'stories written' : `of ${stories.length} stories`}
      </Text>

      {/* Viewer Premium Banner */}
      {currentOwner && currentOwner.subscription_tier !== 'premium' && currentOwner.story_count >= 5 && (
        <TouchableOpacity
          style={styles.viewerPremiumBanner}
          onPress={() => navigation.navigate('Premium', {
            giftForOwnerId: currentOwner.owner_id,
            giftForOwnerName: currentOwner.owner_name,
          })}
        >
          <Text style={[styles.viewerPremiumText, { fontSize: getFontSize(13) }]}>
            {currentOwner.story_count >= 20
              ? `🎁 ${currentOwner.owner_name} has reached the free limit — Gift Premium for unlimited stories`
              : currentOwner.story_count >= 15
              ? `🎁 ${currentOwner.story_count}/20 free stories used — Gift Premium to keep memories going`
              : `🎁 Gift Premium for follow-up questions & richer stories →`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Search Bar with Integrated Filter */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { fontSize: getFontSize(16) }]}
          placeholder="Search stories..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Text style={[styles.filterButtonText, { fontSize: getFontSize(13) }]}>
            {selectedGateTag !== 'all'
              ? `⚡ ${formatGateTag(selectedGateTag)}`
              : selectedDomain !== 'all'
              ? `⚡ ${selectedDomain.charAt(0).toUpperCase() + selectedDomain.slice(1)}`
              : '⚡ All'}
          </Text>
          <Text style={styles.filterDropdownIcon}>▼</Text>
        </TouchableOpacity>
      </View>

      <SwipeListView
        data={filteredStories}
        renderItem={renderStory}
        renderHiddenItem={renderHiddenItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        rightOpenValue={-100}
        disableRightSwipe
        friction={10}
        tension={40}
        ListEmptyComponent={renderEmptyFiltered}
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { fontSize: getFontSize(18) }]}>Filter</Text>
            <ScrollView style={styles.modalList}>
              {/* Domain Section */}
              <Text style={[styles.sectionTitle, { fontSize: getFontSize(14) }]}>By Domain</Text>
              {domains.map((domain) => (
                <TouchableOpacity
                  key={domain}
                  style={[
                    styles.modalOption,
                    selectedDomain === domain && selectedGateTag === 'all' && styles.modalOptionActive
                  ]}
                  onPress={() => {
                    setSelectedDomain(domain);
                    setSelectedGateTag('all');
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      { fontSize: getFontSize(16) },
                      selectedDomain === domain && selectedGateTag === 'all' && styles.modalOptionTextActive
                    ]}
                  >
                    {domain === 'all' ? 'All Stories' : domain.charAt(0).toUpperCase() + domain.slice(1)}
                  </Text>
                  {selectedDomain === domain && selectedGateTag === 'all' && (
                    <Text style={styles.modalCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}

              {/* Gate Tag Section */}
              {gateTags.length > 1 && (
                <>
                  <Text style={[styles.sectionTitle, { fontSize: getFontSize(14), marginTop: 20 }]}>By Life Event</Text>
                  {gateTags.filter(tag => tag !== 'all').map((gateTag) => (
                    <TouchableOpacity
                      key={gateTag}
                      style={[
                        styles.modalOption,
                        selectedGateTag === gateTag && styles.modalOptionActive
                      ]}
                      onPress={() => {
                        setSelectedGateTag(gateTag);
                        setSelectedDomain('all');
                        setShowFilterModal(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.modalOptionText,
                          { fontSize: getFontSize(16) },
                          selectedGateTag === gateTag && styles.modalOptionTextActive
                        ]}
                      >
                        {formatGateTag(gateTag)}
                      </Text>
                      {selectedGateTag === gateTag && (
                        <Text style={styles.modalCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginHorizontal: 20,
    marginBottom: 5,
    color: colors.gray900,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray600,
    marginHorizontal: 20,
    marginBottom: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    ...shadows.medium,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  clearText: {
    fontSize: 18,
    color: colors.gray600,
    fontWeight: 'bold',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginLeft: 8,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
    marginRight: 4,
  },
  filterDropdownIcon: {
    fontSize: 10,
    color: colors.gray600,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxHeight: '70%',
    ...shadows.large,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray600,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  modalOptionActive: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.gray900,
  },
  modalOptionTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  modalCheckmark: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
  },
  rowFront: {
    backgroundColor: '#fff',
    marginBottom: 15,
  },
  rowBack: {
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    flex: 1,
    marginBottom: 15,
  },
  deleteButton: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    height: '100%',
    borderRadius: 16,
    ...shadows.medium,
  },
  deleteIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  storyCard: {
    backgroundColor: colors.white,
    borderWidth: 0,
    borderRadius: 16,
    padding: 16,
    ...shadows.large,
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
    color: colors.gray900,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray600,
  },
  emptyFilteredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  resetButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  resetButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  viewerPremiumBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
  },
  viewerPremiumText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
});
