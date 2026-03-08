import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import RatingComponent from '../components/RatingComponent';
import SkipClarificationModal from '../components/SkipClarificationModal';
import RescueModeChoiceModal from '../components/RescueModeChoiceModal';
import PromptChoiceList from '../components/PromptChoiceList';
import MediaPicker from '../components/MediaPicker';
import ShareAppModal from '../components/ShareAppModal';
import FollowUpQuestionsModal from '../components/FollowUpQuestionsModal';
import { useFontSize } from '../context/FontSizeContext';

export default function DailyPromptScreen({ navigation, route }) {
  const { getFontSize } = useFontSize();
  const [prompt, setPrompt] = useState(null);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [isAnotherPrompt, setIsAnotherPrompt] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Rating and skip state
  const [showRating, setShowRating] = useState(false);
  const [responseId, setResponseId] = useState(null);
  const [showSkipClarification, setShowSkipClarification] = useState(false);
  const [showRescueChoice, setShowRescueChoice] = useState(false);
  const [showPromptList, setShowPromptList] = useState(false);
  const [rescueOptions, setRescueOptions] = useState([]);
  const [promptChoices, setPromptChoices] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    loadPrompt();
    checkPremium();
  }, []);

  const checkPremium = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const subStatus = await ApiService.getSubscriptionStatus(token);
      setIsPremium(subStatus.isPremium);
    } catch (error) {
      setIsPremium(false);
    }
  };

  const loadPrompt = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const mode = route.params?.mode || 'daily';
      const questionId = route.params?.questionId;

      // If a specific questionId is provided, load that question
      if (questionId) {
        const data = await ApiService.getSpecificQuestion(token, questionId);
        if (data.prompt) {
          setPrompt(data.prompt);
        } else {
          setAnswered(true);
        }
      } else if (mode === 'another') {
        // Load next weighted prompt (bonus mode: light/medium, avoid grief/loss)
        setIsAnotherPrompt(true);
        const data = await ApiService.getNextWeightedPrompt(token, 'bonus');
        if (data.prompt) {
          setPrompt(data.prompt);
        } else {
          setAnswered(true);
        }
      } else {
        // Load today's daily prompt
        const data = await ApiService.getTodayPrompt(token);
        console.log('📝 Today prompt data:', JSON.stringify(data, null, 2));

        if (data.answered || data.alreadyAnswered || data.promptAnswered) {
          setAnswered(true);
          if (data.prompt) {
            console.log('📝 Setting answered prompt:', data.prompt);
            setPrompt(data.prompt);
          }
        } else if (data.prompt) {
          console.log('📝 Setting new prompt - ID:', data.prompt.id, 'gate_tag:', data.prompt.gate_tag);
          setPrompt(data.prompt);
        } else {
          // No prompt available
          setAnswered(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!response.trim()) {
      Alert.alert('Error', 'Please write your story first');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      let fileIds = null;

      // Upload files first if any selected
      if (selectedMedia.length > 0) {
        setUploading(true);
        const uploadResult = await ApiService.uploadFiles(token, selectedMedia);
        fileIds = uploadResult.files.map(f => f.id);
        setUploading(false);
      }

      // Include submittedQuestionId if this is a question from a loved one
      const result = await ApiService.submitPromptResponse(
        token,
        prompt?.id || null,
        response,
        prompt?.submittedQuestionId || null,
        fileIds
      );

      // Save response ID and show rating component
      setResponseId(result.id);
      setShowRating(true);
      setSelectedMedia([]);  // Clear media after successful submit
    } catch (error) {
      if (error.upgradeRequired) {
        Alert.alert(
          'Story Limit Reached',
          `You've written ${error.storyCount || 20} of ${error.storyLimit || 20} free stories. Upgrade to Premium for unlimited stories!`,
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Upgrade', onPress: () => navigation.navigate('Premium') }
          ]
        );
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const checkAndShowShareModal = async () => {
    try {
      // Check if user has already seen the share modal
      const hasSeenShareModal = await AsyncStorage.getItem('hasSeenShareModal');
      if (hasSeenShareModal === 'true') {
        navigation.goBack();
        return;
      }

      // Get user stats to check story count
      const token = await AsyncStorage.getItem('authToken');
      const stats = await ApiService.getUserStats(token);

      // If user has 5 or more stories, show share modal (only once)
      if (stats.stats.totalResponses >= 5) {
        setShowShareModal(true);
        await AsyncStorage.setItem('hasSeenShareModal', 'true');
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error checking share modal:', error);
      navigation.goBack();
    }
  };

  const handleRating = async (rating) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.ratePrompt(token, prompt.id, responseId, rating);

      setShowRating(false);
      if (isPremium) {
        setShowFollowUp(true);
      } else {
        Alert.alert('Success!', 'Your story has been saved!', [
          { text: 'OK', onPress: checkAndShowShareModal }
        ]);
      }
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('Error', 'Failed to save rating: ' + error.message);
    }
  };

  const handleSkipRating = () => {
    setShowRating(false);
    if (isPremium) {
      setShowFollowUp(true);
    } else {
      Alert.alert('Success!', 'Your story has been saved!', [
        { text: 'OK', onPress: checkAndShowShareModal }
      ]);
    }
  };

  const handleFollowUpComplete = () => {
    setShowFollowUp(false);
    Alert.alert('Success!', 'Your story has been saved!', [
      { text: 'OK', onPress: checkAndShowShareModal }
    ]);
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
    navigation.goBack();
  };

  const handleSkip = async () => {
    setShowSkipClarification(true);
  };

  const handleSkipWithReason = async (skipReason) => {
    try {
      console.log('⚠️ handleSkipWithReason - prompt object:', prompt);
      console.log('⚠️ Calling skipPrompt with ID:', prompt.id);
      const token = await AsyncStorage.getItem('authToken');
      const result = await ApiService.skipPrompt(token, prompt.id, skipReason);

      setShowSkipClarification(false);

      // Check if we got rescue mode options or prompt choices
      if (result.needsChoice && result.options) {
        setRescueOptions(result.options);
        setShowRescueChoice(true);
      } else if (result.needsChoice && result.choices) {
        setPromptChoices(result.choices);
        setShowPromptList(true);
      } else if (result.nextPrompt) {
        // Got a new prompt directly
        setPrompt(result.nextPrompt);
        setResponse('');
      } else {
        // No more prompts
        setAnswered(true);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      setShowSkipClarification(false);
    }
  };

  const handleSkipDismiss = () => {
    // Skip without reason
    handleSkipWithReason(null);
  };

  const handleModeSelection = async (mode) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const result = await ApiService.getNextWeightedPrompt(token, mode);

      setShowRescueChoice(false);

      if (result.prompt) {
        setPrompt(result.prompt);
        setResponse('');
      } else {
        setAnswered(true);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      setShowRescueChoice(false);
    }
  };

  const handlePromptChoice = async (selectedPrompt) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.choosePrompt(token, selectedPrompt.id);

      setShowPromptList(false);
      setPrompt(selectedPrompt);
      setResponse('');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (answered || !prompt) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.centered}>
          <Text style={[styles.title, { fontSize: getFontSize(28) }]}>✅ All Done!</Text>
          <Text style={[styles.message, { fontSize: getFontSize(16) }]}>
            You've answered today's prompt. Great job!
          </Text>
          <TouchableOpacity
            style={styles.anotherPromptButton}
            onPress={() => navigation.replace('DailyPrompt', { mode: 'another' })}
          >
            <Text style={[styles.anotherPromptButtonText, { fontSize: getFontSize(16) }]}>
              ✍️ Answer Another Prompt
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>{isAnotherPrompt ? 'Your Prompt' : 'Today\'s Prompt'}</Text>

      {prompt?.type === 'submitted' && (
        <View style={styles.submittedBadge}>
          <Text style={[styles.submittedBadgeText, { fontSize: getFontSize(14) }]}>
            💝 Question from {prompt.submitterInfo?.name || 'Loved One'}
          </Text>
        </View>
      )}

      <View style={styles.promptCard}>
        <Text style={[styles.category, { fontSize: getFontSize(12) }]}>
          {prompt?.gate_tag ? `${prompt.gate_tag} (Series)` : (prompt?.category || prompt?.domain || 'Personal')}
        </Text>
        <Text style={[styles.promptText, { fontSize: getFontSize(20) }]}>{prompt?.question || prompt?.prompt_text}</Text>
      </View>

      {prompt?.id ? (
        <>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
          >
            <Text style={[styles.skipButtonText, { fontSize: getFontSize(14) }]}>Skip – Not Today</Text>
          </TouchableOpacity>

          <MediaPicker
            selectedMedia={selectedMedia}
            onMediaChange={setSelectedMedia}
          />

          <Text style={[styles.label, { fontSize: getFontSize(16) }]}>Your Story</Text>
          <TextInput
            style={[styles.textarea, { fontSize: getFontSize(16) }]}
            placeholder="Share your memory or story..."
            value={response}
            onChangeText={setResponse}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect={true}
            spellCheck={true}
          />

          <Text style={[styles.charCount, { fontSize: getFontSize(12) }]}>{response.length} characters</Text>

          <TouchableOpacity
            style={[styles.button, (submitting || uploading) && styles.buttonDisabled]}
            onPress={submitResponse}
            disabled={submitting || uploading}
          >
            {submitting || uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, { fontSize: getFontSize(16) }]}>
                {uploading ? 'Uploading media...' : submitting ? 'Saving...' : 'Save Story'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.centered}>
          <Text style={[styles.message, { fontSize: getFontSize(16) }]}>
            No new prompts available right now.
          </Text>
          <TouchableOpacity
            style={styles.anotherPromptButton}
            onPress={() => navigation.replace('DailyPrompt', { mode: 'another' })}
          >
            <Text style={[styles.anotherPromptButtonText, { fontSize: getFontSize(16) }]}>
              ✍️ Try Another Prompt
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('MyStories')}
          >
            <Text style={[styles.exploreLink, { fontSize: getFontSize(14) }]}>
              Or explore your existing stories
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rating Component - Shows after successful submission */}
      <RatingComponent
        visible={showRating}
        promptId={prompt?.id}
        responseId={responseId}
        onRate={handleRating}
        onSkip={handleSkipRating}
      />

      {/* Skip Clarification Modal */}
      <SkipClarificationModal
        visible={showSkipClarification}
        onSelect={handleSkipWithReason}
        onDismiss={handleSkipDismiss}
      />

      {/* Rescue Mode Choice Modal */}
      <RescueModeChoiceModal
        visible={showRescueChoice}
        options={rescueOptions}
        onSelectMode={handleModeSelection}
      />

      {/* Prompt Choice List (after 3 skips) */}
      <PromptChoiceList
        visible={showPromptList}
        prompts={promptChoices}
        onSelectPrompt={handlePromptChoice}
      />

      {/* AI Follow-Up Questions (premium only) */}
      <FollowUpQuestionsModal
        visible={showFollowUp}
        promptQuestion={prompt?.question || prompt?.prompt_text || ''}
        userResponse={response}
        responseId={responseId}
        promptId={prompt?.id}
        onComplete={handleFollowUpComplete}
      />

      {/* Share App Modal (after 5th story) */}
      <ShareAppModal
        visible={showShareModal}
        onClose={handleCloseShareModal}
      />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backButton: {
    marginTop: 50,
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
    color: '#111',
    textAlign: 'center',
  },
  submittedBadge: {
    backgroundColor: '#fce7f3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  submittedBadgeText: {
    color: '#9d174d',
    fontSize: 14,
    fontWeight: '600',
  },
  promptCard: {
    backgroundColor: '#fef2f2',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  category: {
    color: '#e11d48',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  promptText: {
    fontSize: 18,
    color: '#111',
    lineHeight: 26,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111',
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 200,
    marginBottom: 10,
  },
  charCount: {
    textAlign: 'right',
    color: '#999',
    fontSize: 12,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    paddingHorizontal: 40,
  },
  anotherPromptButton: {
    backgroundColor: '#e11d48',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginTop: 24,
  },
  anotherPromptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  exploreLink: {
    color: '#e11d48',
    marginTop: 16,
    textDecorationLine: 'underline',
  },
});
