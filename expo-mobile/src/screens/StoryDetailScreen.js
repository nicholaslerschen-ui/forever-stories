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
  const [saving, setSaving] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]); // Track existing files to keep
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

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
      console.log('Loaded story with', data.story.files?.length || 0, 'files');
      if (data.story.files) {
        console.log('File IDs:', data.story.files.map(f => f.id));
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
    setExistingFiles(story.files || []); // Copy existing files
    setSelectedMedia([]); // Reset new media
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText('');
    setSelectedMedia([]);
    setExistingFiles([]);
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
        console.log('Uploading', selectedMedia.length, 'new files...');
        setUploading(true);
        const uploadResult = await ApiService.uploadFiles(token, selectedMedia);
        newFileIds = uploadResult.files.map(f => f.id);
        console.log('Uploaded file IDs:', newFileIds);
        setUploading(false);
      }

      // Combine existing file IDs with newly uploaded file IDs
      const existingFileIds = existingFiles.map(f => f.id);
      const allFileIds = [...existingFileIds, ...newFileIds];
      console.log('Existing file IDs:', existingFileIds);
      console.log('All file IDs being sent:', allFileIds);

      await ApiService.updateStory(token, storyId, editedText, allFileIds);
      console.log('Story updated, reloading...');

      // Reload the story to get updated data with signed URLs
      await loadStory();
      console.log('Story reloaded');
      setIsEditing(false);
      setSelectedMedia([]);
      setExistingFiles([]);
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
          {story.title ? 'Title' : 'Prompt'}
        </Text>
        <Text style={[styles.promptText, { fontSize: getFontSize(18) }]}>
          {story.title || story.prompt_text || story.question || 'Untitled Story'}
        </Text>
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
