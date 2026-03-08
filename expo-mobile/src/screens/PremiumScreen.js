import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import ApiService from '../services/api';
import { useFontSize } from '../context/FontSizeContext';

const REVENUECAT_API_KEY = 'test_eZryDvBZDHAfyRMCADhYxfKXEvc';

export default function PremiumScreen({ navigation }) {
  const { getFontSize } = useFontSize();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [storyCount, setStoryCount] = useState(0);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      // Get current subscription status from backend
      const subStatus = await ApiService.getSubscriptionStatus(token);
      setCurrentSubscription(subStatus);
      setStoryCount(subStatus.storyCount || 0);

      // Load available packages from RevenueCat
      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current && offerings.current.availablePackages.length > 0) {
          setPackages(offerings.current.availablePackages);
          // Default to monthly
          const monthly = offerings.current.availablePackages.find(
            p => p.packageType === 'MONTHLY'
          );
          setSelectedPackage(monthly || offerings.current.availablePackages[0]);
        }
      } catch (rcError) {
        console.log('RevenueCat not configured yet:', rcError.message);
      }
    } catch (error) {
      console.error('Failed to load subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Not Available', 'Subscriptions are not yet available. Please check back soon!');
      return;
    }

    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

      // Check if premium is now active
      if (customerInfo.entitlements.active['premium']) {
        Alert.alert(
          'Welcome to Premium!',
          'You now have access to unlimited stories, follow-up questions, and AI Persona Chat.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['premium']) {
        Alert.alert(
          'Purchase Restored',
          'Your premium subscription has been restored.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', error.message || 'Failed to restore purchases.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  // Already premium
  if (currentSubscription?.isPremium) {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>Premium</Text>
        </View>

        <Text style={[styles.title, { fontSize: getFontSize(28) }]}>You're a Premium Member</Text>
        <Text style={[styles.subtitle, { fontSize: getFontSize(16) }]}>
          Thank you for supporting Forever Stories!
        </Text>

        <View style={styles.featureList}>
          <FeatureItem icon="check" text="Unlimited Stories" getFontSize={getFontSize} active />
          <FeatureItem icon="check" text="Follow-up Questions" getFontSize={getFontSize} active />
          <FeatureItem icon="check" text="AI Persona Chat" getFontSize={getFontSize} active />
        </View>

        {currentSubscription.status === 'canceled' && (
          <View style={styles.cancelNotice}>
            <Text style={[styles.cancelNoticeText, { fontSize: getFontSize(14) }]}>
              Your subscription will remain active until{' '}
              {new Date(currentSubscription.endsAt).toLocaleDateString()}.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.manageButton} onPress={() => {
          // Open subscription management in App Store
          if (Platform.OS === 'ios') {
            const { Linking } = require('react-native');
            Linking.openURL('https://apps.apple.com/account/subscriptions');
          }
        }}>
          <Text style={[styles.manageButtonText, { fontSize: getFontSize(16) }]}>
            Manage Subscription
          </Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    );
  }

  // Free tier - show upgrade
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={[styles.backText, { fontSize: getFontSize(16) }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { fontSize: getFontSize(28) }]}>Unlock Premium</Text>
      <Text style={[styles.subtitle, { fontSize: getFontSize(16) }]}>
        Preserve richer, deeper memories with Premium.
      </Text>

      {/* Story count warning */}
      {storyCount >= 15 && (
        <View style={styles.limitWarning}>
          <Text style={[styles.limitWarningText, { fontSize: getFontSize(14) }]}>
            You've written {storyCount} of 20 free stories.
            {storyCount >= 20 ? ' Upgrade to keep writing!' : ''}
          </Text>
        </View>
      )}

      {/* Premium Features */}
      <View style={styles.featureList}>
        <FeatureItem
          icon="stories"
          text="Unlimited Stories"
          description="No limits on the memories you can capture"
          getFontSize={getFontSize}
        />
        <FeatureItem
          icon="followup"
          text="Follow-up Questions"
          description="Additional questions help capture richer details after each story"
          getFontSize={getFontSize}
        />
        <FeatureItem
          icon="ai"
          text="AI Persona Chat"
          description="Let loved ones chat with an AI version of you, powered by your stories"
          getFontSize={getFontSize}
        />
      </View>

      {/* Pricing */}
      <View style={styles.pricingSection}>
        {packages.length > 0 ? (
          packages.map((pkg) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[
                styles.priceCard,
                selectedPackage?.identifier === pkg.identifier && styles.priceCardSelected,
              ]}
              onPress={() => setSelectedPackage(pkg)}
            >
              {pkg.packageType === 'ANNUAL' && (
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>Save 7%</Text>
                </View>
              )}
              <Text style={[styles.priceTitle, { fontSize: getFontSize(16) }]}>
                {pkg.packageType === 'MONTHLY' ? 'Monthly' : 'Annual'}
              </Text>
              <Text style={[styles.priceAmount, { fontSize: getFontSize(24) }]}>
                {pkg.product.priceString}
              </Text>
              <Text style={[styles.pricePeriod, { fontSize: getFontSize(13) }]}>
                {pkg.packageType === 'MONTHLY' ? '/month' : '/year'}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.comingSoon}>
            <Text style={[styles.comingSoonTitle, { fontSize: getFontSize(18) }]}>
              Coming Soon
            </Text>
            <Text style={[styles.comingSoonText, { fontSize: getFontSize(14) }]}>
              Premium subscriptions will be available shortly. All your stories are safe!
            </Text>
          </View>
        )}
      </View>

      {/* Purchase Button */}
      {packages.length > 0 && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={handlePurchase}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.upgradeButtonText, { fontSize: getFontSize(18) }]}>
              Subscribe Now
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Restore Purchases */}
      <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
        <Text style={[styles.restoreButtonText, { fontSize: getFontSize(14) }]}>
          Restore Purchases
        </Text>
      </TouchableOpacity>

      {/* Free tier info */}
      <View style={styles.freeInfo}>
        <Text style={[styles.freeInfoTitle, { fontSize: getFontSize(14) }]}>
          Free Plan Includes:
        </Text>
        <Text style={[styles.freeInfoText, { fontSize: getFontSize(13) }]}>
          Up to 20 stories, daily prompts, share with loved ones
        </Text>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

function FeatureItem({ icon, text, description, getFontSize, active }) {
  const iconMap = {
    stories: '∞',
    followup: '?',
    ai: '✦',
    check: '✓',
  };

  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, active && styles.featureIconActive]}>
        <Text style={[styles.featureIconText, active && styles.featureIconTextActive]}>
          {iconMap[icon] || '✓'}
        </Text>
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={[styles.featureText, { fontSize: getFontSize(16) }]}>{text}</Text>
        {description && (
          <Text style={[styles.featureDescription, { fontSize: getFontSize(13) }]}>
            {description}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    marginTop: 50,
    marginLeft: 20,
    marginBottom: 20,
  },
  backText: {
    color: '#e11d48',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 20,
    color: '#111',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e11d48',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  premiumBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  limitWarning: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#e11d48',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  limitWarningText: {
    color: '#991b1b',
    fontSize: 14,
  },
  featureList: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureIconActive: {
    backgroundColor: '#dcfce7',
  },
  featureIconText: {
    fontSize: 18,
    color: '#e11d48',
    fontWeight: '700',
  },
  featureIconTextActive: {
    color: '#16a34a',
  },
  featureTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  featureText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  featureDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    lineHeight: 18,
  },
  pricingSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  priceCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  priceCardSelected: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  saveBadge: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  saveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  priceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111',
  },
  pricePeriod: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  comingSoon: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#e11d48',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  restoreButtonText: {
    color: '#e11d48',
    fontSize: 14,
  },
  freeInfo: {
    backgroundColor: '#f9fafb',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  freeInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  freeInfoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cancelNotice: {
    backgroundColor: '#fefce8',
    borderLeftWidth: 4,
    borderLeftColor: '#eab308',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  cancelNoticeText: {
    color: '#854d0e',
    fontSize: 14,
  },
  manageButton: {
    borderWidth: 1,
    borderColor: '#e11d48',
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  manageButtonText: {
    color: '#e11d48',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    height: 40,
  },
});
