import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function ManageFamilyScreen({ navigation }) {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGrants();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadGrants();
    });
    return unsubscribe;
  }, [navigation]);

  const loadGrants = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getAccessGrants(token);
      setGrants(data.grants || []);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (grantId, recipientEmail) => {
    Alert.alert(
      'Revoke Access',
      `Are you sure you want to revoke access for ${recipientEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await ApiService.revokeAccess(token, grantId);
              loadGrants();
              Alert.alert('Success', 'Access revoked successfully');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderPermissionBadges = (permissions) => {
    const badges = [];
    if (permissions?.viewStories) {
      badges.push({ icon: '👁️', label: 'View Stories' });
    }
    if (permissions?.chatWithAI) {
      badges.push({ icon: '🤖', label: 'Chat AI' });
    }
    if (permissions?.submitQuestions) {
      badges.push({ icon: '❓', label: 'Questions' });
    }

    return (
      <View style={styles.permissionBadges}>
        {badges.map((badge, index) => (
          <View key={index} style={styles.badge}>
            <Text style={styles.badgeText}>
              {badge.icon} {badge.label}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderGrant = ({ item }) => (
    <View style={styles.grantCard}>
      <View style={styles.grantHeader}>
        <View style={styles.grantInfo}>
          <Text style={styles.recipientEmail}>{item.recipient_email}</Text>
          {item.recipient_name && (
            <Text style={styles.recipientName}>{item.recipient_name}</Text>
          )}
        </View>
      </View>

      {renderPermissionBadges(item.permissions)}

      <View style={styles.grantActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditAccess', { grant: item })}
        >
          <Text style={styles.editText}>Edit Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.revokeButton}
          onPress={() => handleRevoke(item.id, item.recipient_email)}
        >
          <Text style={styles.revokeText}>Revoke</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Family & Friends</Text>
      <Text style={styles.subtitle}>
        Manage who can access your stories and submit questions
      </Text>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('InviteFamily')}
      >
        <Text style={styles.addButtonText}>+ Invite Someone</Text>
      </TouchableOpacity>

      {grants.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No family or friends yet</Text>
          <Text style={styles.emptySubtext}>
            Invite someone to share your stories with them
          </Text>
        </View>
      ) : (
        <FlatList
          data={grants}
          renderItem={renderGrant}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
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
  backButton: {
    marginTop: 50,
    marginLeft: 20,
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
    marginHorizontal: 20,
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  addButton: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  grantCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  grantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  grantInfo: {
    flex: 1,
  },
  recipientEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 14,
    color: '#666',
  },
  permissionBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  badge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#e11d48',
  },
  grantActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e11d48',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  editText: {
    color: '#e11d48',
    fontSize: 14,
    fontWeight: '500',
  },
  revokeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc2626',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  revokeText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
