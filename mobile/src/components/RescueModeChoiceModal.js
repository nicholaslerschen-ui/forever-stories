import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { useFontSize } from '../context/FontSizeContext';

const RescueModeChoiceModal = ({ visible, onSelectMode, onDismiss }) => {
  const { getFontSize } = useFontSize();
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelect = (mode) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onSelectMode(mode);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <Animated.View
          style={[styles.container, { opacity: fadeAnim }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { fontSize: getFontSize(20) }]}>
            Want something different?
          </Text>
          <Text style={[styles.subtitle, { fontSize: getFontSize(14) }]}>
            Let's find a better prompt for you
          </Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.option, styles.optionLight]}
              onPress={() => handleSelect('rescue_light')}
            >
              <Text style={styles.optionIcon}>🌿</Text>
              <View style={styles.optionContent}>
                <Text style={[styles.optionLabel, { fontSize: getFontSize(16) }]}>
                  Something lighter
                </Text>
                <Text style={[styles.optionDesc, { fontSize: getFontSize(13) }]}>
                  Easy, sensory, or place-based prompts
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, styles.optionThoughtful]}
              onPress={() => handleSelect('rescue_thoughtful')}
            >
              <Text style={styles.optionIcon}>🧠</Text>
              <View style={styles.optionContent}>
                <Text style={[styles.optionLabel, { fontSize: getFontSize(16) }]}>
                  Something thoughtful
                </Text>
                <Text style={[styles.optionDesc, { fontSize: getFontSize(13) }]}>
                  Reflective prompts, but not too deep
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, styles.optionSurprise]}
              onPress={() => handleSelect('rescue_surprise')}
            >
              <Text style={styles.optionIcon}>🎲</Text>
              <View style={styles.optionContent}>
                <Text style={[styles.optionLabel, { fontSize: getFontSize(16) }]}>
                  Surprise me
                </Text>
                <Text style={[styles.optionDesc, { fontSize: getFontSize(13) }]}>
                  Random from available prompts
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onDismiss}>
            <Text style={[styles.cancelText, { fontSize: getFontSize(14) }]}>
              Never mind
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
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
  title: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionLight: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  optionThoughtful: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  optionSurprise: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  optionIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  optionDesc: {
    color: '#6b7280',
    lineHeight: 18,
  },
  arrow: {
    fontSize: 20,
    color: '#9ca3af',
    marginLeft: 8,
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f9fafb',
  },
  cancelText: {
    color: '#6b7280',
    fontWeight: '600',
  },
});

export default RescueModeChoiceModal;
