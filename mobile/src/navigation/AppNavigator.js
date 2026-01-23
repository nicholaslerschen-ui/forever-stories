import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import DailyPromptScreen from '../screens/DailyPromptScreen';
import MyStoriesScreen from '../screens/MyStoriesScreen';
import StoryDetailScreen from '../screens/StoryDetailScreen';
import AIChatScreen from '../screens/AIChatScreen';
import FreeWriteScreen from '../screens/FreeWriteScreen';
import AccountScreen from '../screens/AccountScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ManageFamilyScreen from '../screens/ManageFamilyScreen';
import InviteFamilyScreen from '../screens/InviteFamilyScreen';
import EditAccessScreen from '../screens/EditAccessScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import SubmitQuestionScreen from '../screens/SubmitQuestionScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="DailyPrompt" component={DailyPromptScreen} />
        <Stack.Screen name="MyStories" component={MyStoriesScreen} />
        <Stack.Screen name="StoryDetail" component={StoryDetailScreen} />
        <Stack.Screen name="AIChat" component={AIChatScreen} />
        <Stack.Screen name="FreeWrite" component={FreeWriteScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ManageFamily" component={ManageFamilyScreen} />
        <Stack.Screen name="InviteFamily" component={InviteFamilyScreen} />
        <Stack.Screen name="EditAccess" component={EditAccessScreen} />
        <Stack.Screen name="Questions" component={QuestionsScreen} />
        <Stack.Screen name="SubmitQuestion" component={SubmitQuestionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}