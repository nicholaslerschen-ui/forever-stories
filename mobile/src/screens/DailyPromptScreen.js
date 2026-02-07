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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import RatingComponent from '../components/RatingComponent';
import SkipClarificationModal from '../components/SkipClarificationModal';
import RescueModeChoiceModal from '../components/RescueModeChoiceModal';
import PromptChoiceList from '../components/PromptChoiceList';
import MediaPicker from '../components/MediaPicker';

export default function DailyPromptScreen({ navigation, route }) {
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

  useEffect(() => {
    loadPrompt();
  }, []);

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

        if (data.answered || data.alreadyAnswered || data.promptAnswered) {
          setAnswered(true);
          if (data.prompt) {
            setPrompt(data.prompt);
          }
        } else if (data.prompt) {
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

      // Include submittedQuestionId if this is a question from family
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
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleRating = async (rating) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.ratePrompt(token, prompt.id, responseId, rating);

      setShowRating(false);
      Alert.alert('Success!', 'Your story has been saved!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('Error', 'Failed to save rating: ' + error.message);
    }
  };

  const handleSkipRating = () => {
    setShowRating(false);
    Alert.alert('Success!', 'Your story has been saved!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  const handleSkip = async () => {
    setShowSkipClarification(true);
  };

  const handleSkipWithReason = async (skipReason) => {
    try {
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.centered}>
          <Text style={styles.title}>✅ All Done!</Text>
          <Text style={styles.message}>
            You've answered today's prompt. Come back tomorrow for a new one!
          </Text>
        </View>
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

      <Text style={styles.title}>{isAnotherPrompt ? 'Your Prompt' : 'Today\'s Prompt'}</Text>

      {prompt?.type === 'submitted' && (
        <View style={styles.submittedBadge}>
          <Text style={styles.submittedBadgeText}>
            💝 Question from {prompt.submitterInfo?.name || 'Family'}
          </Text>
        </View>
      )}

      <View style={styles.promptCard}>
        <Text style={styles.category}>
          {prompt?.gate_tag ? `${prompt.gate_tag} (Series)` : (prompt?.category || prompt?.domain || 'Personal')}
        </Text>
        <Text style={styles.promptText}>{prompt?.question || prompt?.prompt_text}</Text>
      </View>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
      >
        <Text style={styles.skipButtonText}>Skip – Not Today</Text>
      </TouchableOpacity>

      <MediaPicker
        selectedMedia={selectedMedia}
        onMediaChange={setSelectedMedia}
      />

      <Text style={styles.label}>Your Story</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Share your memory or story..."
        value={response}
        onChangeText={setResponse}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
      />

      <Text style={styles.charCount}>{response.length} characters</Text>

      <TouchableOpacity
        style={[styles.button, (submitting || uploading) && styles.buttonDisabled]}
        onPress={submitResponse}
        disabled={submitting || uploading}
      >
        {submitting || uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {uploading ? 'Uploading media...' : submitting ? 'Saving...' : 'Save Story'}
          </Text>
        )}
      </TouchableOpacity>

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
        onSelectReason={handleSkipWithReason}
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
    </ScrollView>
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
});
