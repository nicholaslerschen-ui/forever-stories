import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal } from 'react-native';
import { useFontSize } from '../context/FontSizeContext';

const RatingComponent = ({ visible, promptId, responseId, onRate, onSkip }) => {
  const { getFontSize } = useFontSize();
  const [selected, setSelected] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleRating = (rating) => {
    setSelected(rating);

    // Animate out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onRate(rating);
    });
  };

  const handleSkipRating = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onSkip();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={[styles.question, { fontSize: getFontSize(16) }]}>
        Was this a good prompt for you today?
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.ratingButton,
            selected === 3 && styles.ratingButtonSelected,
          ]}
          onPress={() => handleRating(3)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>✅</Text>
          <Text style={[styles.label, { fontSize: getFontSize(14) }]}>Yes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.ratingButton,
            selected === 2 && styles.ratingButtonSelected,
          ]}
          onPress={() => handleRating(2)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>😐</Text>
          <Text style={[styles.label, { fontSize: getFontSize(14) }]}>
            It was okay
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.ratingButton,
            selected === 1 && styles.ratingButtonSelected,
          ]}
          onPress={() => handleRating(1)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>🚫</Text>
          <Text style={[styles.label, { fontSize: getFontSize(14) }]}>
            Not right today
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleSkipRating} style={styles.skipButton}>
        <Text style={[styles.skipText, { fontSize: getFontSize(13) }]}>
          Skip this question →
        </Text>
      </TouchableOpacity>

      <Text style={[styles.optional, { fontSize: getFontSize(12) }]}>
        Optional - this helps us learn your preferences
      </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  question: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  ratingButtonSelected: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  emoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  label: {
    color: '#374151',
    textAlign: 'center',
    fontWeight: '500',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  skipText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  optional: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 8,
  },
});

export default RatingComponent;
