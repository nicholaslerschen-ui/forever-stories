import React from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { FontSizeProvider } from './src/context/FontSizeContext';

export default function App() {
  return (
    <FontSizeProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </FontSizeProvider>
  );
}
