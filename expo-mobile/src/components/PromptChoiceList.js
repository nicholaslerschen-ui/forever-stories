import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { useFontSize } from '../context/FontSizeContext';

const PromptChoiceList = ({ visible, prompts = [], onSelectPrompt, onDismiss }) => {
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

  const handleSelect = (prompt) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      onSelectPrompt(prompt);
    });
  };

  const getDepthColor = (depth) => {
    switch (depth) {
      case 'light':
        return '#86efac';
      case 'medium':
        return '#93c5fd';
      case 'heavy':
        return '#fca5a1';
      default:
        return '#9ca3af';
    }
  };

  const getDepthLabel = (depth) => {
    switch (depth) {
      case 'light':
        return 'Light';
      case 'medium':
        return 'Medium';
      case 'heavy':
        return 'Deep';
      default:
        return depth;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
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
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: getFontSize(20) }]}>
              Pick a prompt that feels right
            </Text>
            <Text style={[styles.subtitle, { fontSize: getFontSize(14) }]}>
              Choose any of these {prompts.length} prompts
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {prompts.map((prompt, index) => (
              <TouchableOpacity
                key={prompt.id}
                style={styles.promptCard}
                onPress={() => handleSelect(prompt)}
                activeOpacity={0.7}
              >
                <View style={styles.promptHeader}>
                  <View style={styles.badges}>
                    <View style={styles.domainBadge}>
                      <Text style={[styles.badgeText, { fontSize: getFontSize(11) }]}>
                        {prompt.domain}
                      </Text>
                    </View>
                    <View style={styles.storyTypeBadge}>
                      <Text style={[styles.badgeText, { fontSize: getFontSize(11) }]}>
                        {prompt.story_type}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.depthIndicator,
                      { backgroundColor: getDepthColor(prompt.depth) },
                    ]}
                  >
                    <Text style={[styles.depthText, { fontSize: getFontSize(10) }]}>
                      {getDepthLabel(prompt.depth)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.promptText, { fontSize: getFontSize(15) }]}>
                  {prompt.question || prompt.prompt_text}
                </Text>

                {prompt.gate_tag && (
                  <View style={styles.gateTag}>
                    <Text style={[styles.gateText, { fontSize: getFontSize(11) }]}>
                      🔓 {prompt.gate_tag.replace(/_/g, ' ')}
                    </Text>
                  </View>
                )}

                <View style={styles.selectButton}>
                  <Text style={[styles.selectText, { fontSize: getFontSize(14) }]}>
                    Choose this prompt →
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.cancelButton} onPress={onDismiss}>
            <Text style={[styles.cancelText, { fontSize: getFontSize(15) }]}>
              Show me something else
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
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7280',
    textAlign: 'center',
  },
  scrollView: {
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  promptCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 6,
  },
  domainBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  storyTypeBadge: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
  },
  depthIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  depthText: {
    color: '#111827',
    fontWeight: '700',
  },
  promptText: {
    color: '#111827',
    lineHeight: 22,
    marginBottom: 12,
  },
  gateTag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  gateText: {
    color: '#92400e',
    fontWeight: '600',
  },
  selectButton: {
    backgroundColor: '#f9fafb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectText: {
    color: '#e11d48',
    fontWeight: '700',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    marginTop: 8,
  },
  cancelText: {
    color: '#6b7280',
    fontWeight: '600',
  },
});

export default PromptChoiceList;
