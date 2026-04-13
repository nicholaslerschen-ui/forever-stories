import { Share, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

/**
 * Generate an invite code and open the native share sheet.
 * @param {'owner' | 'viewer'} inviteType - 'owner' = owner inviting viewer, 'viewer' = viewer inviting owner
 * @returns {Promise<boolean>} true if share sheet was opened
 */
export async function shareInvite(inviteType = 'owner') {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const userData = await AsyncStorage.getItem('user');
    const user = userData ? JSON.parse(userData) : null;
    const senderName = user?.full_name || 'Someone';

    let result;
    if (inviteType === 'viewer') {
      result = await ApiService.generateReverseInviteCode(token);
    } else {
      result = await ApiService.generateInviteCode(token);
    }

    const inviteCode = result.inviteCode;
    const appLink = 'https://www.foreverstories.co';

    let message;
    if (inviteType === 'owner') {
      message =
        `${senderName} invited you to read their stories on Forever Stories!\n\n` +
        `Use this invite code when you sign up: ${inviteCode}\n\n` +
        `Download the app: ${appLink}`;
    } else {
      message =
        `${senderName} wants to read your stories on Forever Stories!\n\n` +
        `Create your account and use this invite code to connect: ${inviteCode}\n\n` +
        `Download the app: ${appLink}`;
    }

    await Share.share({
      message,
      title: 'Forever Stories Invite',
    });

    return true;
  } catch (error) {
    Alert.alert('Error', 'Failed to create invite. Please try again.');
    return false;
  }
}
