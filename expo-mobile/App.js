import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import AppNavigator from './src/navigation/AppNavigator';
import { FontSizeProvider } from './src/context/FontSizeContext';

const REVENUECAT_API_KEY = 'appl_YntqdavXkJnesgAnAIfxzGBpWLV';

export default function App() {
  useEffect(() => {
    const initRevenueCat = async () => {
      try {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        }
        Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        console.log('RevenueCat initialized');
      } catch (error) {
        console.log('RevenueCat init error:', error.message);
      }
    };
    initRevenueCat();
  }, []);

  return (
    <FontSizeProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </FontSizeProvider>
  );
}
