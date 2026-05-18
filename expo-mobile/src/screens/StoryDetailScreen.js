import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import MediaPicker from '../components/MediaPicker';
import MediaViewerModal from '../components/MediaViewerModal';
import { useFontSize } from '../context/FontSizeContext';

export default function StoryDetailScreen({ route, navigation }) {
  const { getFontSize } = useFontSize();
  const { storyId } = route.params;
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]); // Track existing files to keep
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [editedFollowUps, setEditedFollowUps] = useState([]);

  useEffect(() => {
    loadCurrentUser();
    loadStory();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadStory = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getStoryDetail(token, storyId);
      if (data.story.files) {
      }
      setStory(data.story);
    } catch (error) {
      console.error('Load story error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleEdit = () => {
    setEditedText(story.response_text);
    setEditedTitle(story.title || '');
    setExistingFiles(story.files || []); // Copy existing files
    setSelectedMedia([]); // Reset new media
    // Initialize editable follow-ups
    let followUps = [];
    try {
      followUps = typeof story.follow_up_questions === 'string'
        ? JSON.parse(story.follow_up_questions)
        : story.follow_up_questions || [];
    } catch (e) {}
    setEditedFollowUps(Array.isArray(followUps) ? followUps.map(item => ({ ...item })) : []);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText('');
    setSelectedMedia([]);
    setExistingFiles([]);
    setEditedFollowUps([]);
  };

  const removeExistingFile = (fileId) => {
    setExistingFiles(existingFiles.filter(f => f.id !== fileId));
  };

  const handleSave = async () => {
    if (!editedText.trim()) {
      Alert.alert('Error', 'Story text cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');

      let newFileIds = [];

      // Upload new files if any selected
      if (selectedMedia.length > 0) {
        setUploading(true);
        const uploadResult = await ApiService.uploadFiles(token, selectedMedia);
        newFileIds = uploadResult.files.map(f => f.id);
        setUploading(false);
      }

      // Combine existing file IDs with newly uploaded file IDs
      const existingFileIds = existingFiles.map(f => f.id);
      const allFileIds = [...existingFileIds, ...newFileIds];

      const followUpData = editedFollowUps.length > 0 ? editedFollowUps : null;
      await ApiService.updateStory(token, storyId, editedText, editedTitle, allFileIds, followUpData);

      // Reload the story to get updated data with signed URLs
      await loadStory();
      setIsEditing(false);
      setSelectedMedia([]);
      setExistingFiles([]);
      setEditedFollowUps([]);
      Alert.alert('Success', 'Story updated successfully!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (!story) {
    return (
      <View style={styles.centered}>
        <Text>Story not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
        </TouchableOpacity>

        {!isEditing && currentUserId && story.user_id === currentUserId && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEdit}
          >
            <Text style={[styles.editButtonText, { fontSize: getFontSize(16) }]}>✏️ Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.header}>
        <Text style={[styles.date, { fontSize: getFontSize(14) }]}>{formatDate(story.created_at)}</Text>
        {story.response_type && (
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontSize: getFontSize(12) }]}>{story.response_type}</Text>
          </View>
        )}
      </View>

      <View style={styles.promptCard}>
        <Text style={[styles.promptLabel, { fontSize: getFontSize(12) }]}>
          {story.title || story.response_type === 'freewrite' ? 'Title' : 'Prompt'}
        </Text>
        {isEditing && (story.title || story.response_type === 'freewrite') ? (
          <TextInput
            style={[styles.titleInput, { fontSize: getFontSize(18) }]}
            value={editedTitle}
            onChangeText={setEditedTitle}
            placeholder="Enter title (optional)"
          />
        ) : (
          <Text style={[styles.promptText, { fontSize: getFontSize(18) }]}>
            {story.title || story.prompt_text || story.question || 'Untitled Story'}
          </Text>
        )}
      </View>

      <View style={styles.storyCard}>
        <Text style={[styles.storyLabel, { fontSize: getFontSize(12) }]}>Your Story</Text>
        {isEditing ? (
          <TextInput
            style={[styles.storyInput, { fontSize: getFontSize(16) }]}
            value={editedText}
            onChangeText={setEditedText}
            multiline
            textAlignVertical="top"
            placeholder="Write your story here..."
          />
        ) : (
          <Text style={[styles.storyText, { fontSize: getFontSize(16) }]}>{story.response_text}</Text>
        )}
      </View>

      {/* Follow-up Q&A - Edit Mode */}
      {isEditing && editedFollowUps.length > 0 && (
        <View style={styles.followUpSection}>
          <Text style={[styles.followUpLabel, { fontSize: getFontSize(12) }]}>Follow-up Details</Text>
          {editedFollowUps.map((item, index) => (
            <View key={index} style={styles.followUpItem}>
              <View style={styles.followUpQuestionCard}>
                <Text style={[styles.followUpQuestion, { fontSize: getFontSize(15) }]}>
                  {item.question}
                </Text>
              </View>
              <TextInput
                style={[styles.followUpAnswerInput, { fontSize: getFontSize(16) }]}
                value={item.answer}
                onChangeText={(text) => {
                  const updated = [...editedFollowUps];
                  updated[index] = { ...updated[index], answer: text };
                  setEditedFollowUps(updated);
                }}
                multiline
                textAlignVertical="top"
                placeholder="Edit your answer..."
              />
            </View>
          ))}
        </View>
      )}

      {/* Follow-up Q&A - View Mode */}
      {!isEditing && story.follow_up_questions && (() => {
        let followUps = [];
        try {
          followUps = typeof story.follow_up_questions === 'string'
            ? JSON.parse(story.follow_up_questions)
            : story.follow_up_questions;
        } catch (e) {}
        if (!Array.isArray(followUps) || followUps.length === 0) return null;
        return (
          <View style={styles.followUpSection}>
            <Text style={[styles.followUpLabel, { fontSize: getFontSize(12) }]}>Follow-up Details</Text>
            {followUps.map((item, index) => (
              <View key={index} style={styles.followUpItem}>
                <View style={styles.followUpQuestionCard}>
                  <Text style={[styles.followUpQuestion, { fontSize: getFontSize(15) }]}>
                    {item.question}
                  </Text>
                </View>
                <Text style={[styles.followUpAnswer, { fontSize: getFontSize(16) }]}>
                  {item.answer}
                </Text>
              </View>
            ))}
          </View>
        );
      })()}

      {/* Media Gallery - Edit Mode */}
      {isEditing && (
        <View style={styles.mediaSection}>
          <Text style={[styles.mediaLabel, { fontSize: getFontSize(12) }]}>Photos & Videos</Text>

          {/* Combined gallery: existing files + new files */}
          {(existingFiles.length > 0 || selectedMedia.length > 0) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.combinedMediaScroll}
            >
              {/* Existing Files */}
              {existingFiles.map((file) => (
                <View key={file.id} style={styles.mediaThumb}>
                  {file.file_type.startsWith('image/') ? (
                    <Image
                      source={{ uri: file.file_path }}
                      style={styles.mediaImage}
                    />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <Text style={styles.videoIcon}>▶️</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeFileButton}
                    onPress={() => removeExistingFile(file.id)}
                  >
                    <Text style={styles.removeFileText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* New Files */}
              {selectedMedia.map((media, index) => (
                <View key={`new-${index}`} style={styles.mediaThumb}>
                  <Image
                    source={{ uri: media.uri }}
                    style={styles.mediaImage}
                  />
                  <TouchableOpacity
                    style={styles.removeFileButton}
                    onPress={() => {
                      const updated = [...selectedMedia];
                      updated.splice(index, 1);
                      setSelectedMedia(updated);
                    }}
                  >
                    <Text style={styles.removeFileText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* More indicator */}
              {(existingFiles.length + selectedMedia.length) > 3 && (
                <View style={styles.moreIndicatorContainer}>
                  <Text style={styles.moreIndicatorText}>→</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Add Photos Button */}
          <MediaPicker
            selectedMedia={selectedMedia}
            onMediaChange={setSelectedMedia}
            showThumbnails={false}
          />
        </View>
      )}

      {/* Media Gallery - View Mode */}
      {!isEditing && story.files && story.files.length > 0 && (
        <View style={styles.mediaGallery}>
          <Text style={[styles.mediaLabel, { fontSize: getFontSize(12) }]}>Photos & Videos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {story.files.map((file, index) => (
              <TouchableOpacity
                key={file.id}
                style={styles.mediaThumb}
                onPress={() => {
                  setViewerInitialIndex(index);
                  setShowMediaViewer(true);
                }}
              >
                {file.file_type.startsWith('image/') ? (
                  <Image
                    source={{ uri: file.file_path }}
                    style={styles.mediaImage}
                  />
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoIcon}>▶️</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {isEditing && (
        <View style={styles.editActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={handleCancelEdit}
            disabled={saving}
          >
            <Text style={[styles.cancelButtonText, { fontSize: getFontSize(16) }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSave}
            disabled={saving || uploading}
          >
            {saving || uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.saveButtonText, { fontSize: getFontSize(16) }]}>
                {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Changes'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.spacer} />

      {/* Media Viewer Modal */}
      <MediaViewerModal
        visible={showMediaViewer}
        files={story?.files || []}
        initialIndex={viewerInitialIndex}
        onClose={() => setShowMediaViewer(false)}
      />
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 50,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#e11d48',
    fontSize: 16,
  },
  editButton: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  badge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e11d48',
    textTransform: 'uppercase',
  },
  promptCard: {
    backgroundColor: '#fef2f2',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e11d48',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  promptText: {
    fontSize: 16,
    color: '#111',
    lineHeight: 24,
  },
  titleInput: {
    fontSize: 18,
    color: '#111',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  storyCard: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  storyLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  storyText: {
    fontSize: 16,
    color: '#111',
    lineHeight: 24,
  },
  storyInput: {
    fontSize: 16,
    color: '#111',
    lineHeight: 24,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#e11d48',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    height: 40,
  },
  followUpSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  followUpLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e11d48',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  followUpItem: {
    marginBottom: 16,
  },
  followUpQuestionCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#e11d48',
    marginBottom: 8,
  },
  followUpQuestion: {
    color: '#333',
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  followUpAnswer: {
    color: '#111',
    lineHeight: 24,
    paddingLeft: 4,
  },
  followUpAnswerInput: {
    color: '#111',
    lineHeight: 24,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  mediaSection: {
    paddingHorizontal: 20,
    marginBottom: 20
  },
  mediaGallery: {
    marginTop: 20,
    paddingHorizontal: 20
  },
  mediaLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  combinedMediaScroll: {
    marginBottom: 15,
    maxHeight: 130
  },
  mediaThumb: {
    marginRight: 10,
    position: 'relative'
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: 8
  },
  videoPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  videoIcon: {
    fontSize: 32
  },
  removeFileButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#e11d48',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff'
  },
  removeFileText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 14
  },
  moreIndicatorContainer: {
    width: 40,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center'
  },
  moreIndicatorText: {
    fontSize: 32,
    color: '#666'
  }
});
