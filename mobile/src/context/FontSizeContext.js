import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FontSizeContext = createContext();

export const FontSizeProvider = ({ children }) => {
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1.0);

  useEffect(() => {
    loadFontSize();
  }, []);

  const loadFontSize = async () => {
    try {
      const saved = await AsyncStorage.getItem('fontSizeMultiplier');
      if (saved) {
        setFontSizeMultiplier(parseFloat(saved));
      }
    } catch (error) {
      console.error('Error loading font size:', error);
    }
  };

  const updateFontSize = async (multiplier) => {
    try {
      await AsyncStorage.setItem('fontSizeMultiplier', multiplier.toString());
      setFontSizeMultiplier(multiplier);
    } catch (error) {
      console.error('Error saving font size:', error);
    }
  };

  const getFontSize = (baseSize) => {
    return baseSize * fontSizeMultiplier;
  };

  return (
    <FontSizeContext.Provider value={{ fontSizeMultiplier, updateFontSize, getFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within FontSizeProvider');
  }
  return context;
};
