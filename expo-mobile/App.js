import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import * as Sentry from '@sentry/react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { FontSizeProvider } from './src/context/FontSizeContext';

Sentry.init({
  dsn: 'https://e127bd941b6bdc94842b719aa4e13e90@o4511425851817984.ingest.us.sentry.io/4511425893826560',
  enabled: !__DEV__,
});

const REVENUECAT_API_KEY = 'appl_YntqdavXkJnesgAnAIfxzGBpWLV';

export default Sentry.wrap(function App() {
  useEffect(() => {
    const initRevenueCat = async () => {
      try {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        }
        Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      } catch (error) {
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
});
