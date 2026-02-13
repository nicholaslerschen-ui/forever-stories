import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function MediaPicker({ selectedMedia, onMediaChange, showThumbnails = true }) {
  const pickMedia = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos to attach them to your stories.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets) {
        handleMediaSelection(result.assets);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your camera to take photos for your stories.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets) {
        handleMediaSelection(result.assets);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleMediaSelection = async (assets) => {
    const newMedia = [];

    for (const asset of assets) {
      const mimeType = asset.mimeType || (asset.type === 'image' ? 'image/jpeg' : 'video/mp4');

      newMedia.push({
        uri: asset.uri,
        type: mimeType,
        fileName: asset.fileName || `media_${Date.now()}.${mimeType.split('/')[1]}`,
        fileSize: asset.fileSize || 0
      });
    }

    // Check if adding new media would exceed the 10 file limit
    const totalMedia = [...selectedMedia, ...newMedia];
    if (totalMedia.length > 10) {
      Alert.alert(
        'Too Many Files',
        `You can only attach up to 10 photos and videos per story. You currently have ${selectedMedia.length} selected. Please remove some files first.`,
        [{ text: 'OK' }]
      );
      return;
    }

    onMediaChange(totalMedia);
  };

  const removeMedia = (index) => {
    const updated = [...selectedMedia];
    updated.splice(index, 1);
    onMediaChange(updated);
  };

  return (
    <View style={styles.container}>
      {/* Show thumbnails above button if enabled and media exists */}
      {showThumbnails && selectedMedia.length > 0 && (
        <ScrollView
          horizontal
          style={styles.mediaList}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaListContent}
        >
          {selectedMedia.map((media, index) => (
            <View key={index} style={styles.mediaItem}>
              <Image source={{ uri: media.uri }} style={styles.thumbnail} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeMedia(index)}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {selectedMedia.length > 3 && (
            <View style={styles.moreIndicator}>
              <Text style={styles.moreText}>→</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Media Button */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>📷 Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={pickMedia}>
          <Text style={styles.buttonText}>🖼️ Gallery</Text>
        </TouchableOpacity>
      </View>

      {selectedMedia.length > 0 && (
        <Text style={styles.countText}>
          {selectedMedia.length} {selectedMedia.length === 1 ? 'photo' : 'photos'} selected
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#e11d48',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mediaList: {
    marginBottom: 12,
  },
  mediaListContent: {
    paddingRight: 10,
  },
  mediaItem: {
    marginRight: 10,
    position: 'relative',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#e11d48',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  removeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  moreIndicator: {
    width: 40,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 24,
    color: '#666',
  },
  countText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
});
