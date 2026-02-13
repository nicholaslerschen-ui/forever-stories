import React, { useState } from 'react';
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
import MediaPicker from '../components/MediaPicker';
import ShareAppModal from '../components/ShareAppModal';
import { useFontSize } from '../context/FontSizeContext';

export default function FreeWriteScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

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

  const handleCloseShareModal = () => {
    setShowShareModal(false);
    navigation.goBack();
  };

  const submitStory = async () => {
    if (!story.trim()) {
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

      await ApiService.submitFreeWrite(token, title || 'Untitled Story', story, fileIds);

      Alert.alert('Success!', 'Your story has been saved!', [
        { text: 'OK', onPress: checkAndShowShareModal }
      ]);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

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
          <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
        </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>Create a Story</Text>
      <Text style={[styles.subtitle, { fontSize: getFontSize(16) }]}>Write your favorite stories and memories</Text>

      <MediaPicker
        selectedMedia={selectedMedia}
        onMediaChange={setSelectedMedia}
      />

      <Text style={[styles.label, { fontSize: getFontSize(16) }]}>Title (optional)</Text>
      <TextInput
        style={[styles.input, { fontSize: getFontSize(16) }]}
        placeholder="Give your story a title..."
        value={title}
        onChangeText={setTitle}
        autoCapitalize="words"
        autoCorrect={true}
        spellCheck={true}
      />

      <Text style={[styles.label, { fontSize: getFontSize(16) }]}>Your Story</Text>
      <TextInput
        style={[styles.textarea, { fontSize: getFontSize(16) }]}
        placeholder="Start writing your story..."
        value={story}
        onChangeText={setStory}
        multiline
        numberOfLines={10}
        textAlignVertical="top"
        autoCapitalize="sentences"
        autoCorrect={true}
        spellCheck={true}
      />

      <Text style={[styles.charCount, { fontSize: getFontSize(12) }]}>{story.length} characters</Text>

      <TouchableOpacity
        style={[styles.button, (submitting || uploading) && styles.buttonDisabled]}
        onPress={submitStory}
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
    marginBottom: 5,
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
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
});