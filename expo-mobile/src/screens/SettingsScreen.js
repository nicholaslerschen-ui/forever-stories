import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFontSize } from '../context/FontSizeContext';

export default function SettingsScreen({ navigation }) {
  const { fontSizeMultiplier, updateFontSize, getFontSize } = useFontSize();

  const fontSizeOptions = [
    { label: 'Small', value: 0.85 },
    { label: 'Medium', value: 1.0 },
    { label: 'Large', value: 1.15 },
    { label: 'Extra Large', value: 1.3 },
  ];

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>Settings</Text>

      {/* Text Size Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>
          Text Size
        </Text>
        <Text style={[styles.sectionSubtitle, { fontSize: getFontSize(14) }]}>
          Choose a comfortable reading size
        </Text>

        <View style={styles.fontSizeContainer}>
          {fontSizeOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.fontSizeButton,
                fontSizeMultiplier === option.value && styles.fontSizeButtonActive,
              ]}
              onPress={() => updateFontSize(option.value)}
            >
              <Text
                style={[
                  styles.fontSizeButtonText,
                  { fontSize: getFontSize(14) },
                  fontSizeMultiplier === option.value && styles.fontSizeButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
              <Text
                style={[
                  styles.fontSizePreview,
                  { fontSize: option.value * 20 },
                  fontSizeMultiplier === option.value && styles.fontSizeButtonTextActive,
                ]}
              >
                Aa
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.previewBox}>
          <Text style={[styles.previewText, { fontSize: getFontSize(16) }]}>
            Preview: This is how your text will look in the app.
          </Text>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: getFontSize(18) }]}>
          Notifications
        </Text>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() => navigation.navigate('NotificationSettings')}
        >
          <Text style={[styles.helpButtonText, { fontSize: getFontSize(16) }]}>
            Notification Preferences
          </Text>
          <Text style={[styles.helpButtonSubtext, { fontSize: getFontSize(13) }]}>
            Change reminder times and notification types
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    marginTop: 50,
    marginLeft: 20,
    marginBottom: 20,
  },
  backText: {
    color: '#e11d48',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 20,
    marginHorizontal: 20,
    color: '#111',
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 5,
  },
  sectionSubtitle: {
    color: '#666',
    marginBottom: 15,
  },
  fontSizeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fontSizeButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  fontSizeButtonActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  fontSizeButtonText: {
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  fontSizeButtonTextActive: {
    color: '#e11d48',
  },
  fontSizePreview: {
    color: '#666',
    fontWeight: 'bold',
  },
  previewBox: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  previewText: {
    color: '#111',
    lineHeight: 24,
  },
  helpButton: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  helpButtonText: {
    color: '#111',
    fontWeight: '600',
    marginBottom: 4,
  },
  helpButtonSubtext: {
    color: '#666',
  },
  spacer: {
    height: 40,
  },
});
