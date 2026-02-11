import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';

export default function TimezonePicker({ visible, onClose, onSelectTimezone, currentTimezone }) {
  const [searchQuery, setSearchQuery] = useState('');

  // Get all available timezones
  const allTimezones = useMemo(() => {
    try {
      if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
        return Intl.supportedValuesOf('timeZone');
      }
    } catch (e) {
      // Fallback to common timezones if Intl.supportedValuesOf is not available
    }

    // Fallback list of common timezones
    return [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Phoenix',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'America/Toronto',
      'America/Vancouver',
      'America/Mexico_City',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Moscow',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Asia/Singapore',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland',
    ];
  }, []);

  // Filter timezones based on search
  const filteredTimezones = useMemo(() => {
    if (!searchQuery.trim()) {
      return allTimezones;
    }

    const lowercaseQuery = searchQuery.toLowerCase();
    return allTimezones.filter((tz) =>
      tz.toLowerCase().includes(lowercaseQuery)
    );
  }, [searchQuery, allTimezones]);

  // Format timezone for display
  const formatTimezone = (tz) => {
    // Convert "America/New_York" to "America - New York"
    const parts = tz.split('/');
    if (parts.length === 2) {
      return `${parts[0]} - ${parts[1].replace(/_/g, ' ')}`;
    } else if (parts.length === 3) {
      return `${parts[0]} - ${parts[1]} - ${parts[2].replace(/_/g, ' ')}`;
    }
    return tz;
  };

  const handleSelect = (timezone) => {
    onSelectTimezone(timezone);
    onClose();
  };

  const renderTimezone = ({ item }) => {
    const isSelected = item === currentTimezone;

    return (
      <TouchableOpacity
        style={[styles.timezoneItem, isSelected && styles.timezoneItemSelected]}
        onPress={() => handleSelect(item)}
      >
        <View style={styles.timezoneInfo}>
          <Text style={[styles.timezoneName, isSelected && styles.timezoneNameSelected]}>
            {formatTimezone(item)}
          </Text>
          <Text style={[styles.timezoneCode, isSelected && styles.timezoneCodeSelected]}>
            {item}
          </Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
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
          <Text style={styles.title}>Select Timezone</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Search timezones..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />

        {filteredTimezones.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching timezones found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTimezones}
            renderItem={renderTimezone}
            keyExtractor={(item) => item}
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
  timezoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 10,
  },
  timezoneItemSelected: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#e11d48',
  },
  timezoneInfo: {
    flex: 1,
  },
  timezoneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  timezoneNameSelected: {
    color: '#e11d48',
  },
  timezoneCode: {
    fontSize: 13,
    color: '#6b7280',
  },
  timezoneCodeSelected: {
    color: '#be123c',
  },
  checkmark: {
    fontSize: 24,
    color: '#e11d48',
    marginLeft: 10,
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
