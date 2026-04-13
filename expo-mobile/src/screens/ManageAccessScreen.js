import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useFontSize } from '../context/FontSizeContext';
import { shareInvite } from '../utils/shareInvite';

export default function ManageAccessScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadViewers();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadViewers();
    });
    return unsubscribe;
  }, [navigation]);

  const loadViewers = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getMyViewers(token);
      setViewers(data.viewers || []);
    } catch (error) {
      console.error('Load viewers error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareInvite = async () => {
    setSharing(true);
    await shareInvite('owner');
    setSharing(false);
  };

  const toggleAccess = async (grantId, currentlyActive, viewerName) => {
    const action = currentlyActive ? 'turn OFF' : 'turn ON';

    Alert.alert(
      'Confirm',
      `Are you sure you want to ${action} access for ${viewerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await ApiService.toggleViewerAccess(token, grantId);
              loadViewers();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>Loved Ones</Text>
      <Text style={[styles.subtitle, { fontSize: getFontSize(15) }]}>
        Share your stories with family and friends
      </Text>

      {/* Share Invite Button */}
      <TouchableOpacity
        style={[styles.shareButton, sharing && styles.buttonDisabled]}
        onPress={handleShareInvite}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={[styles.shareButtonText, { fontSize: getFontSize(16) }]}>
              Share Invite
            </Text>
            <Text style={[styles.shareButtonSubtext, { fontSize: getFontSize(13) }]}>
              Send via text, email, or any app
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Viewers List */}
      <View style={styles.viewersSection}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>
          Who Has Access
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#e11d48" style={{ marginTop: 20 }} />
        ) : viewers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { fontSize: getFontSize(15) }]}>
              No loved ones yet
            </Text>
            <Text style={[styles.emptySubtext, { fontSize: getFontSize(13) }]}>
              Share an invite to get started
            </Text>
          </View>
        ) : (
          viewers.map((viewer) => (
            <View key={viewer.grant_id} style={styles.viewerCard}>
              <View style={styles.viewerInfo}>
                <Text style={[styles.viewerName, { fontSize: getFontSize(16) }]}>
                  {viewer.viewer_name}
                </Text>
                <Text style={[styles.viewerEmail, { fontSize: getFontSize(14) }]}>
                  {viewer.viewer_email}
                </Text>
              </View>
              <Switch
                value={viewer.is_active}
                onValueChange={() =>
                  toggleAccess(viewer.grant_id, viewer.is_active, viewer.viewer_name)
                }
                trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                thumbColor={viewer.is_active ? '#e11d48' : '#f3f4f6'}
              />
            </View>
          ))
        )}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  backButton: {
    marginTop: 50,
    marginBottom: 20,
  },
  backText: {
    color: '#e11d48',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#111',
  },
  subtitle: {
    color: '#666',
    marginBottom: 25,
    lineHeight: 22,
  },
  shareButton: {
    backgroundColor: '#e11d48',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 35,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  shareButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  viewersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: '#9ca3af',
  },
  emptySubtext: {
    color: '#d1d5db',
    marginTop: 4,
  },
  viewerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  viewerEmail: {
    color: '#6b7280',
  },
  spacer: {
    height: 40,
  },
});
