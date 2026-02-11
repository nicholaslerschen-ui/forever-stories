import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import PersonalInfoScreen from '../screens/PersonalInfoScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const navigationRef = useRef();

  useEffect(() => {
    // Set global navigation ref for PushNotificationService
    global.navigationRef = navigationRef;
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
