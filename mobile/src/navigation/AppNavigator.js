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
      </Stack.Navigator>
    </NavigationContainer>
  );
}