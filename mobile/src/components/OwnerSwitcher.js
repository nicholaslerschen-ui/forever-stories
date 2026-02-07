import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function OwnerSwitcher({ visible, onClose, onSelectOwner }) {
  const [owners, setOwners] = useState([]);
  const [currentOwnerId, setCurrentOwnerId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadOwners();
    }
  }, [visible]);

  const loadOwners = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const currentOwner = await AsyncStorage.getItem('currentOwnerId');

      // Get all owners this viewer has access to
      const data = await ApiService.getMyOwners(token);

      setOwners(data.owners);
      setCurrentOwnerId(currentOwner);
    } catch (error) {
      console.error('Load owners error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectOwner = async (ownerId) => {
    await AsyncStorage.setItem('currentOwnerId', ownerId);
    setCurrentOwnerId(ownerId);
    onSelectOwner(ownerId);
    onClose();
  };

  const renderOwner = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.ownerCard,
        item.owner_id === currentOwnerId && styles.ownerCardActive
      ]}
      onPress={() => selectOwner(item.owner_id)}
    >
      <View style={styles.ownerInfo}>
        <Text style={styles.ownerName}>{item.owner_name}</Text>
        <Text style={styles.ownerEmail}>{item.owner_email}</Text>
      </View>
      {item.owner_id === currentOwnerId && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Switch Owner</Text>
          <Text style={styles.subtitle}>View stories and questions from:</Text>

          <FlatList
            data={owners}
            renderItem={renderOwner}
            keyExtractor={(item) => item.owner_id}
            style={styles.list}
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  list: {
    marginBottom: 16,
  },
  ownerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  ownerCardActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ownerEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  checkmark: {
    fontSize: 24,
    color: '#e11d48',
  },
  closeButton: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});
