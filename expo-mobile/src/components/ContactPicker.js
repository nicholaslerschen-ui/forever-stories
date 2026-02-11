import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Contacts from 'expo-contacts';

export default function ContactPicker({ visible, onClose, onSelectContact, mode = 'both' }) {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  const loadContacts = async () => {
    try {
      setLoading(true);

      // Check current permission status first
      const { status: currentStatus } = await Contacts.getPermissionsAsync();

      let finalStatus = currentStatus;

      // If not granted, request permission
      if (currentStatus !== 'granted') {
        const { status: requestStatus } = await Contacts.requestPermissionsAsync();
        finalStatus = requestStatus;
      }

      if (finalStatus !== 'granted') {
        setLoading(false);
        Alert.alert(
          'Permission Required',
          'Forever Stories needs access to your contacts to help you invite loved ones. Please enable Contacts access in Settings.',
          [{ text: 'OK', onPress: onClose }]
        );
        return;
      }

      // Request ALL contacts with all available fields
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.Emails,
          Contacts.Fields.PhoneNumbers,
        ],
        pageSize: 0, // Get all contacts (0 = no limit)
        sort: Contacts.SortTypes.FirstName,
      });

      // Filter contacts that have either email or phone based on mode
      const validContacts = data.filter((contact) => {
        let isValid = false;

        if (mode === 'email') {
          isValid = contact.emails && contact.emails.length > 0;
        } else if (mode === 'phone' || mode === 'sms') {
          // Handle both 'phone' and 'sms' mode
          isValid = contact.phoneNumbers && contact.phoneNumbers.length > 0;
        } else {
          // both
          isValid = (
            (contact.emails && contact.emails.length > 0) ||
            (contact.phoneNumbers && contact.phoneNumbers.length > 0)
          );
        }

        return isValid;
      });

      // Sort by name
      validContacts.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });

      setContacts(validContacts);
      setFilteredContacts(validContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      setLoading(false);
      Alert.alert(
        'Error',
        `Failed to load contacts: ${error.message}. Please make sure Contacts permission is enabled in Settings.`,
        [{ text: 'OK', onPress: onClose }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const filtered = contacts.filter((contact) => {
      const name = (contact.name || '').toLowerCase();
      const email = contact.emails?.[0]?.email?.toLowerCase() || '';
      const phone = contact.phoneNumbers?.[0]?.number || '';

      return (
        name.includes(lowercaseQuery) ||
        email.includes(lowercaseQuery) ||
        phone.includes(lowercaseQuery)
      );
    });

    setFilteredContacts(filtered);
  };

  const handleSelectContact = (contact) => {
    const email = contact.emails?.[0]?.email || '';
    const phone = contact.phoneNumbers?.[0]?.number || '';
    const name = contact.name || 'Unknown';

    onSelectContact({ name, email, phone });
    onClose();
  };

  const renderContact = ({ item }) => {
    const email = item.emails?.[0]?.email || '';
    const phone = item.phoneNumbers?.[0]?.number || '';

    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => handleSelectContact(item)}
      >
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name || 'Unknown'}</Text>
          {email && <Text style={styles.contactDetail}>{email}</Text>}
          {phone && <Text style={styles.contactDetail}>{phone}</Text>}
        </View>
        <Text style={styles.selectButton}>→</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Contact</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChangeText={handleSearch}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e11d48" />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching contacts found' : 'No contacts available'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6b7280',
  },
  searchInput: {
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 10,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectButton: {
    fontSize: 24,
    color: '#e11d48',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
