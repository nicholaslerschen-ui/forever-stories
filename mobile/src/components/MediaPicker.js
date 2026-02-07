import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { compress } from 'react-native-compressor';

export default function MediaPicker({ selectedMedia, onMediaChange, showThumbnails = true }) {
  const pickMedia = async () => {
    const options = {
      mediaType: 'mixed', // photo or video
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1920,
      selectionLimit: 10 - selectedMedia.length  // Up to 10 total
    };

    const result = await launchImageLibrary(options);

    if (!result.didCancel && result.assets) {
      handleMediaSelection(result.assets);
    }
  };

  const handleMediaSelection = async (assets) => {
    const newMedia = [];

    for (const asset of assets) {
      // Compress if it's an image
      let uri = asset.uri;
      if (asset.type && asset.type.startsWith('image/')) {
        try {
          uri = await compress(asset.uri, {
            compressionMethod: 'auto',
            quality: 0.8
          });
        } catch (e) {
          console.log('Compression failed, using original:', e);
        }
      }

      newMedia.push({
        uri,
        type: asset.type,
        fileName: asset.fileName,
        fileSize: asset.fileSize
      });
    }

    onMediaChange([...selectedMedia, ...newMedia]);
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

      {/* Single button to add photos */}
      <TouchableOpacity style={styles.addButton} onPress={pickMedia}>
        <Text style={styles.addButtonText}>+ Add Photos/Videos</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20
  },
  mediaList: {
    marginBottom: 10,
    maxHeight: 90
  },
  mediaListContent: {
    paddingRight: 10
  },
  mediaItem: {
    marginRight: 10,
    position: 'relative'
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#e11d48',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  moreIndicator: {
    width: 40,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center'
  },
  moreText: {
    fontSize: 24,
    color: '#666'
  },
  addButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e11d48',
    borderStyle: 'dashed',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  addButtonText: {
    color: '#e11d48',
    fontSize: 14,
    fontWeight: '600'
  }
});
