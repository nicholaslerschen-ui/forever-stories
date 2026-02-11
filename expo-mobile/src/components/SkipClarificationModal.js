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

const SkipClarificationModal = ({ visible, onSelect, onDismiss }) => {
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

  const handleSelect = (reason) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onSelect(reason);
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
        onPress={() => handleSelect(null)}
      >
        <Animated.View
          style={[styles.container, { opacity: fadeAnim }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { fontSize: getFontSize(18) }]}>
            Help us understand
          </Text>
          <Text style={[styles.subtitle, { fontSize: getFontSize(13) }]}>
            Optional - you can just skip
          </Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleSelect('not_today')}
            >
              <Text style={styles.optionIcon}>🕒</Text>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionLabel, { fontSize: getFontSize(15) }]}>
                  Not today
                </Text>
                <Text style={[styles.optionDesc, { fontSize: getFontSize(12) }]}>
                  Maybe another time
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => handleSelect('not_relevant')}
            >
              <Text style={styles.optionIcon}>🚫</Text>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionLabel, { fontSize: getFontSize(15) }]}>
                  Not relevant to me
                </Text>
                <Text style={[styles.optionDesc, { fontSize: getFontSize(12) }]}>
                  This topic doesn't apply
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.option}
              onPress={() => handleSelect('similar_answered')}
            >
              <Text style={styles.optionIcon}>✓</Text>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionLabel, { fontSize: getFontSize(15) }]}>
                  Already answered similar
                </Text>
                <Text style={[styles.optionDesc, { fontSize: getFontSize(12) }]}>
                  I've covered this before
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => handleSelect(null)}
          >
            <Text style={[styles.dismissText, { fontSize: getFontSize(15) }]}>
              Just skip
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  optionDesc: {
    color: '#6b7280',
  },
  dismissButton: {
    padding: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dismissText: {
    color: '#6b7280',
    fontWeight: '600',
  },
});

export default SkipClarificationModal;
