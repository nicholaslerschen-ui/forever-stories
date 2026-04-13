import React, { useRef, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import DailyPromptScreen from '../screens/DailyPromptScreen';
import MyStoriesScreen from '../screens/MyStoriesScreen';
import StoryDetailScreen from '../screens/StoryDetailScreen';
import AIChatScreen from '../screens/AIChatScreen';
import FreeWriteScreen from '../screens/FreeWriteScreen';
import AccountScreen from '../screens/AccountScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FamilyQuestionsScreen from '../screens/FamilyQuestionsScreen';
import ManageAccessScreen from '../screens/ManageAccessScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import SubmitQuestionScreen from '../screens/SubmitQuestionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AcceptInviteScreen from '../screens/AcceptInviteScreen';
import InviteParentScreen from '../screens/InviteParentScreen';
import IntakeInviteScreen from '../screens/IntakeInviteScreen';
import PersonalInfoScreen from '../screens/PersonalInfoScreen';
import PremiumScreen from '../screens/PremiumScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ContactSupportScreen from '../screens/ContactSupportScreen';
import ApiService from '../services/api';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const navigationRef = useRef();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    // Set global navigation ref for PushNotificationService
    global.navigationRef = navigationRef;
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        // Validate token by making a lightweight API call
        const stats = await ApiService.getUserStats(token);
        if (stats) {
          // Identify returning user with RevenueCat
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            try { await Purchases.logIn(user.id); } catch (e) { console.log('RevenueCat logIn:', e.message); }
          }
          setInitialRoute('Dashboard');
        }
      }
    } catch (error) {
      // Token invalid or expired — clear it and go to login
      console.log('Auth check failed, going to login:', error.message);
      await AsyncStorage.removeItem('authToken');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
        <Stack.Screen name="IntakeInvite" component={IntakeInviteScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="DailyPrompt" component={DailyPromptScreen} />
        <Stack.Screen name="MyStories" component={MyStoriesScreen} />
        <Stack.Screen name="StoryDetail" component={StoryDetailScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="FreeWrite" component={FreeWriteScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ManageAccess" component={ManageAccessScreen} />
        <Stack.Screen name="FamilyQuestions" component={FamilyQuestionsScreen} />
        <Stack.Screen name="Questions" component={QuestionsScreen} />
        <Stack.Screen name="SubmitQuestion" component={SubmitQuestionScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} />
        <Stack.Screen name="InviteParent" component={InviteParentScreen} />
        <Stack.Screen name="Premium" component={PremiumScreen} />
        <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
