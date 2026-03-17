import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';
import { useFontSize } from '../context/FontSizeContext';

export default function AIChatScreen({ navigation, route }) {
  const { getFontSize } = useFontSize();
  const ownerId = route.params?.ownerId || null;
  const ownerName = route.params?.ownerName || null;
  const isViewerMode = !!ownerId;

  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: isViewerMode
        ? `Hi! I'm ${ownerName}'s AI persona, built from their life stories. Ask me anything about their memories!`
        : "Hi! I'm your AI persona, trained on your stories. Ask me anything about your memories!",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(null); // null = loading, true/false = known
  const flatListRef = useRef(null);

  useEffect(() => {
    checkPremiumStatus();
  }, []);

  const checkPremiumStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (isViewerMode) {
        // For viewers, try sending a test-like request to check if owner has premium
        // We'll just set premium to true and handle errors when sending
        setIsPremium(true);
      } else {
        const subStatus = await ApiService.getSubscriptionStatus(token);
        setIsPremium(subStatus.isPremium);
      }
    } catch (error) {
      console.error('Failed to check premium status:', error);
      setIsPremium(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('authToken');

      // Get chat history for context
      const history = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await ApiService.sendAIMessage(token, inputText, history, ownerId);

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      if (error.upgradeRequired) {
        if (error.ownerNotPremium) {
          // Owner doesn't have premium — viewer can't do anything about this
          const errorMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `AI Persona isn't available yet. ${ownerName} needs to upgrade to Premium to enable this feature.`,
          };
          setMessages(prev => [...prev, errorMessage]);
          setIsPremium(false);
        } else {
          setIsPremium(false);
        }
        return;
      }
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          { fontSize: getFontSize(16) },
          item.role === 'user' ? styles.userMessageText : styles.aiMessageText,
        ]}
      >
        {item.content}
      </Text>
    </View>
  );

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const headerTitle = isViewerMode ? `${ownerName}'s Persona` : 'AI Persona';
  const placeholder = isViewerMode
    ? `Ask about ${ownerName}'s memories...`
    : 'Ask about your memories...';

  // Loading state
  if (isPremium === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  // Not premium - show paywall (only for owners testing their own persona)
  if (!isPremium && !isViewerMode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: getFontSize(18) }]}>{headerTitle}</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.paywallContainer}>
          <View style={styles.paywallIcon}>
            <Text style={styles.paywallIconText}>✦</Text>
          </View>
          <Text style={[styles.paywallTitle, { fontSize: getFontSize(24) }]}>Premium Feature</Text>
          <Text style={[styles.paywallDescription, { fontSize: getFontSize(16) }]}>
            AI Persona lets loved ones chat with an AI version of you, powered by your life stories. It speaks in your voice and recalls your memories.
          </Text>
          <Text style={[styles.paywallDescription, { fontSize: getFontSize(16) }]}>
            Upgrade to Premium to unlock this feature, follow-up questions, and unlimited stories.
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => navigation.navigate('Premium')}
          >
            <Text style={[styles.upgradeButtonText, { fontSize: getFontSize(18) }]}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Owner not premium but viewer trying to use (show friendly message)
  if (!isPremium && isViewerMode) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontSize: getFontSize(18) }]}>{headerTitle}</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.paywallContainer}>
          <View style={styles.paywallIcon}>
            <Text style={styles.paywallIconText}>✦</Text>
          </View>
          <Text style={[styles.paywallTitle, { fontSize: getFontSize(24) }]}>Not Available Yet</Text>
          <Text style={[styles.paywallDescription, { fontSize: getFontSize(16) }]}>
            AI Persona isn't available yet. {ownerName} needs to upgrade to Premium to enable this feature.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // Premium - show full chat
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: getFontSize(18) }]}>{headerTitle}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { fontSize: getFontSize(16) }]}
          placeholder={placeholder}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          autoCapitalize="sentences"
          autoCorrect={true}
          spellCheck={true}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.sendButtonText, { fontSize: getFontSize(16) }]}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backText: {
    color: '#e11d48',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesList: {
    padding: 20,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 15,
    padding: 12,
    borderRadius: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#e11d48',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#111',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#e11d48',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Paywall styles
  paywallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  paywallIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  paywallIconText: {
    fontSize: 36,
    color: '#e11d48',
  },
  paywallTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  paywallDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: '#e11d48',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    marginTop: 16,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
