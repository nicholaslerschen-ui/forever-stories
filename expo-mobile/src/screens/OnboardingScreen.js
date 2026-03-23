import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const LIFE_EVENTS = [
  { id: 'parenthood', label: 'Parenthood', icon: '👶', description: 'Raising children' },
  { id: 'siblings', label: 'Siblings', icon: '👫', description: 'Growing up with brothers or sisters' },
  { id: 'partnership_marriage', label: 'Partnership/Marriage', icon: '💑', description: 'Long-term relationship or marriage' },
  { id: 'college_education', label: 'College Education', icon: '🎓', description: 'University or higher education' },
  { id: 'immigration', label: 'Immigration', icon: '✈️', description: 'Moving to a new country' },
  { id: 'military_service', label: 'Military Service', icon: '🎖️', description: 'Serving in the military' },
  { id: 'career_pivot', label: 'Career Change', icon: '💼', description: 'Major career transition' },
  { id: 'major_move', label: 'Major Move', icon: '🏡', description: 'Relocating to a new place' },
  { id: 'loss_grief', label: 'Loss/Grief', icon: '🕊️', description: 'Experiencing significant loss' },
  { id: 'caregiving', label: 'Caregiving', icon: '🤝', description: 'Caring for family member' },
  { id: 'faith_community', label: 'Faith Community', icon: '🙏', description: 'Active in religious/spiritual group' },
  { id: 'sports_competition', label: 'Sports/Competition', icon: '⚽', description: 'Competitive athletics' },
  { id: 'creative_hobby', label: 'Creative Pursuit', icon: '🎨', description: 'Art, music, or creative hobby' },
];

export default function OnboardingScreen({ navigation }) {
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggleEvent = (eventId) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const handleContinue = async () => {
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      // Save selected life events as unlocked gates
      const selectedArray = Array.from(selectedEvents);
      if (selectedArray.length > 0) {
        await ApiService.unlockGates(token, selectedArray);
      }

      // Mark onboarding as complete
      await AsyncStorage.setItem('onboardingComplete', 'true');

      // Navigate to personal info screen
      navigation.replace('PersonalInfo');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save your selections');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem('onboardingComplete', 'true');
      navigation.replace('PersonalInfo');
    } catch (error) {
      Alert.alert('Error', 'Failed to continue');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Forever Stories! 🌟</Text>
        <Text style={styles.subtitle}>
          Select the life experiences that shape your story
        </Text>
        <Text style={styles.description}>
          This helps us personalize your prompts with questions that are meaningful to you.
          You can always add more later.
        </Text>
      </View>

      <View style={styles.eventsContainer}>
        {LIFE_EVENTS.map((event) => {
          const isSelected = selectedEvents.has(event.id);
          return (
            <TouchableOpacity
              key={event.id}
              style={[styles.eventCard, isSelected && styles.eventCardSelected]}
              onPress={() => toggleEvent(event.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.eventIcon}>{event.icon}</Text>
              <View style={styles.eventContent}>
                <Text style={[styles.eventLabel, isSelected && styles.eventLabelSelected]}>
                  {event.label}
                </Text>
                <Text style={[styles.eventDescription, isSelected && styles.eventDescriptionSelected]}>
                  {event.description}
                </Text>
              </View>
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Premium Awareness */}
      <View style={styles.premiumInfo}>
        <Text style={styles.premiumInfoTitle}>Your Free Plan</Text>
        <Text style={styles.premiumInfoText}>
          Start with 20 free stories and daily prompts. When you're ready for more, upgrade to Premium for unlimited stories, AI follow-up questions, and AI Persona Chat.
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Premium')}>
          <Text style={styles.premiumInfoLink}>Learn about Premium →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleContinue}
          disabled={submitting}
        >
          <Text style={styles.buttonPrimaryText}>
            {submitting ? 'Saving...' : selectedEvents.size > 0 ? `Continue with ${selectedEvents.size} selected` : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonSkip}
          onPress={handleSkip}
          disabled={submitting}
        >
          <Text style={styles.buttonSkipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 8,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  eventsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  eventCardSelected: {
    borderColor: '#e11d48',
    backgroundColor: '#fff1f2',
  },
  eventIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  eventLabelSelected: {
    color: '#e11d48',
  },
  eventDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  eventDescriptionSelected: {
    color: '#be123c',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 10,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#e11d48',
    marginBottom: 12,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSkip: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonSkipText: {
    color: '#6b7280',
    fontSize: 14,
  },
  premiumInfo: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  premiumInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  premiumInfoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  premiumInfoLink: {
    fontSize: 14,
    color: '#e11d48',
    fontWeight: '600',
  },
});
