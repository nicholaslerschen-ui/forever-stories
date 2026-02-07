import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// import notifee from '@notifee/react-native'; // Temporarily disabled - RN 0.83.1 build incompatible with Xcode 16.4
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
import ManageFamilyScreen from '../screens/ManageFamilyScreen';
import FamilyAccessScreen from '../screens/FamilyAccessScreen';
import FamilyQuestionsScreen from '../screens/FamilyQuestionsScreen';
import InviteFamilyScreen from '../screens/InviteFamilyScreen';
import EditAccessScreen from '../screens/EditAccessScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import SubmitQuestionScreen from '../screens/SubmitQuestionScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AcceptInviteScreen from '../screens/AcceptInviteScreen';
import InviteParentScreen from '../screens/InviteParentScreen';
import IntakeInviteScreen from '../screens/IntakeInviteScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const navigationRef = useRef();

  useEffect(() => {
    // Temporarily disabled - RN 0.83.1 build incompatible with Xcode 16.4
    /*
    // Handle notification tap when app is in background or killed
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === 1 && navigationRef.current) { // PRESS event
        const data = detail.notification?.data;
        if (data?.type === 'daily_reminder') {
          navigationRef.current.navigate('DailyPrompt');
        }
      }
    });

    // Handle notification tap when app is in foreground
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === 1 && navigationRef.current) { // PRESS event
        const data = detail.notification?.data;
        if (data?.type === 'daily_reminder') {
          navigationRef.current.navigate('DailyPrompt');
        }
      }
    });

    return () => unsubscribe();
    */
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="IntakeInvite" component={IntakeInviteScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="DailyPrompt" component={DailyPromptScreen} />
        <Stack.Screen name="MyStories" component={MyStoriesScreen} />
        <Stack.Screen name="StoryDetail" component={StoryDetailScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="FreeWrite" component={FreeWriteScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ManageFamily" component={ManageFamilyScreen} />
        <Stack.Screen name="FamilyAccess" component={FamilyAccessScreen} />
        <Stack.Screen name="FamilyQuestions" component={FamilyQuestionsScreen} />
        <Stack.Screen name="InviteFamily" component={InviteFamilyScreen} />
        <Stack.Screen name="EditAccess" component={EditAccessScreen} />
        <Stack.Screen name="Questions" component={QuestionsScreen} />
        <Stack.Screen name="SubmitQuestion" component={SubmitQuestionScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
        <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} />
        <Stack.Screen name="InviteParent" component={InviteParentScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
