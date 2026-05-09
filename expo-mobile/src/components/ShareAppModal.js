import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import ContactPicker from './ContactPicker';

export default function ShareAppModal({ visible, onClose }) {
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [modalVisible, setModalVisible] = useState(visible);

  // Sync modal visibility with prop
  React.useEffect(() => {
    setModalVisible(visible);
  }, [visible]);

  const shareMessage =
    'Check out Forever Stories - preserve your memories and life stories! ' +
    'A beautiful app to answer daily prompts, write your stories, and share them with loved ones. ' +
    'Download it today!';

  const handleOpenContactPicker = () => {
    setModalVisible(false); // Close celebration modal first
    setTimeout(() => {
      setShowContactPicker(true); // Then open contact picker
    }, 300); // Small delay for smooth transition
  };

  const handleCloseContactPicker = () => {
    setShowContactPicker(false);
    onClose(); // Close everything when contact picker closes
  };

  const handleContactSelect = async (contact) => {
    const { name, email, phone } = contact;

    // Determine best method to share
    const options = [];

    if (email) {
      options.push({
        text: 'Send Email',
        onPress: () => shareViaEmail(email, name),
      });
    }

    if (phone) {
      options.push({
        text: 'Send Text Message',
        onPress: () => shareViaSMS(phone, name),
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    if (options.length === 2) {
      // Only one option (plus Cancel), go directly
      if (email) {
        shareViaEmail(email, name);
      } else {
        shareViaSMS(phone, name);
      }
    } else {
      // Multiple options, show action sheet
      Alert.alert('How would you like to share?', `Contact: ${name}`, options);
    }
  };

  const shareViaEmail = async (email, name) => {
    try {
      const subject = encodeURIComponent('Check out Forever Stories!');
      const body = encodeURIComponent(shareMessage);
      const url = `mailto:${email}?subject=${subject}&body=${body}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        setShowContactPicker(false);
        onClose(); // Close everything after sharing
      } else {
        Alert.alert('Error', 'Unable to open email app');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open email app');
    }
  };

  const shareViaSMS = async (phone, name) => {
    try {
      const url = `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(shareMessage)}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        setShowContactPicker(false);
        onClose(); // Close everything after sharing
      } else {
        Alert.alert('Error', 'Unable to open messaging app');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open messaging app');
    }
  };

  return (
    <>
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Celebration Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.celebrationIcon}>🎉</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>You're on a Roll!</Text>

            {/* Message */}
            <Text style={styles.message}>
              You're building an incredible legacy. Help loved ones preserve their stories too!
            </Text>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleOpenContactPicker}
            >
              <Text style={styles.shareButtonText}>
                👥 Share with Contacts
              </Text>
            </TouchableOpacity>

            {/* Maybe Later Button */}
            <TouchableOpacity
              style={styles.laterButton}
              onPress={onClose}
            >
              <Text style={styles.laterButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ContactPicker
        visible={showContactPicker}
        onClose={handleCloseContactPicker}
        onSelectContact={handleContactSelect}
        mode="both"
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  celebrationIcon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  shareButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  laterButton: {
    paddingVertical: 12,
  },
  laterButtonText: {
    color: '#9ca3af',
    fontSize: 15,
  },
});
