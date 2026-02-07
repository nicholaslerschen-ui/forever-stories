# Phase 2: Invite Flows Implementation Plan

**Date:** February 1, 2026
**Status:** ✅ COMPLETE
**Dependencies:** Phase 1 (Role System, Binary Access) ✅ COMPLETED

---

## Overview

Phase 2 implements the invite system that allows:
1. **Owners** to invite family members (Viewers) to access their stories
2. **Viewers** to accept invites and gain access
3. **Access management** - Owners can turn access ON/OFF for each Viewer

### Key Requirements from Master Spec

- **Simple Binary Access:** Each viewer has one access state per owner: ON or OFF
- **Owner-Initiated Invites:** Default access is ON when owner sends invite
- **Invite Methods:** Email invites with unique invite codes
- **Access Control:** Owner can revoke/restore access from Settings → Family Access

---

## Database Schema Changes

### Migration: 003_phase2_invites.sql

#### 1. Add Invite Tokens Table

```sql
CREATE TABLE invite_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(100) UNIQUE NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_user_id UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_invite_tokens_code ON invite_tokens(invite_code);
CREATE INDEX idx_invite_tokens_owner ON invite_tokens(owner_id);
CREATE INDEX idx_invite_tokens_active ON invite_tokens(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE invite_tokens IS 'Invite codes sent by owners to family members';
COMMENT ON COLUMN invite_tokens.invite_code IS 'Unique 8-character alphanumeric code (e.g., ABC123XY)';
COMMENT ON COLUMN invite_tokens.expires_at IS 'Invites expire after 30 days if not used';
```

#### 2. Enhance Access Grants Table

```sql
-- Add columns to track invite source
ALTER TABLE access_grants
ADD COLUMN invited_via_code VARCHAR(100),
ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN access_granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX idx_access_grants_viewer ON access_grants(viewer_id);
CREATE INDEX idx_access_grants_owner ON access_grants(owner_id);

COMMENT ON COLUMN access_grants.invited_via_code IS 'The invite code used to create this access grant';
COMMENT ON COLUMN access_grants.invited_at IS 'When the viewer accepted the invite';
```

---

## Backend Implementation

### File: `/Users/admin/Desktop/forever-stories/server.js`

### 1. Install Email Service (Nodemailer or SendGrid)

```bash
npm install nodemailer
```

**Environment Variables (.env):**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=noreply@foreverstories.app
EMAIL_PASSWORD=your_app_password
FRONTEND_URL=http://localhost:3001
```

### 2. Email Service Helper

```javascript
const nodemailer = require('nodemailer');

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Helper: Send invite email
async function sendInviteEmail(recipientEmail, inviteCode, ownerName) {
  const inviteUrl = `${process.env.FRONTEND_URL}/accept-invite/${inviteCode}`;

  const mailOptions = {
    from: `Forever Stories <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `${ownerName} has invited you to Forever Stories`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to Forever Stories</h2>
        <p>${ownerName} has invited you to view their stories and ask questions.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #e11d48; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Accept Invitation
        </a>
        <p>Or enter this code in the app: <strong>${inviteCode}</strong></p>
        <p style="color: #666; font-size: 14px;">This invitation expires in 30 days.</p>
      </div>
    `
  };

  await emailTransporter.sendMail(mailOptions);
}

// Helper: Generate unique invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

### 3. API Endpoints

#### POST `/api/invites/send` - Owner sends invite to family member

```javascript
app.post('/api/invites/send', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { recipientEmail } = req.body;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email address required' });
    }

    // Verify user is an Owner
    const ownerCheck = await pool.query(
      'SELECT role, full_name FROM users WHERE id = $1',
      [ownerId]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can send invites' });
    }

    const ownerName = ownerCheck.rows[0].full_name;

    // Generate unique invite code
    let inviteCode;
    let isUnique = false;
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const existing = await pool.query(
        'SELECT id FROM invite_tokens WHERE invite_code = $1',
        [inviteCode]
      );
      isUnique = existing.rows.length === 0;
    }

    // Create invite token (expires in 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `INSERT INTO invite_tokens
       (owner_id, invite_code, recipient_email, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [ownerId, inviteCode, recipientEmail.toLowerCase(), expiresAt]
    );

    // Send invite email
    try {
      await sendInviteEmail(recipientEmail, inviteCode, ownerName);
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      // Don't fail the request if email fails - user can still use the code
    }

    res.json({
      success: true,
      inviteCode,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});
```

#### POST `/api/invites/accept` - Viewer accepts invite

```javascript
app.post('/api/invites/accept', authenticateToken, async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code required' });
    }

    // Verify user is a Viewer
    const viewerCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [viewerId]
    );

    if (viewerCheck.rows.length === 0 || viewerCheck.rows[0].role !== 'viewer') {
      return res.status(403).json({ error: 'Only viewers can accept invites' });
    }

    // Find and validate invite token
    const inviteResult = await pool.query(
      `SELECT * FROM invite_tokens
       WHERE invite_code = $1 AND is_active = TRUE`,
      [inviteCode.toUpperCase()]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invite code' });
    }

    const invite = inviteResult.rows[0];

    // Check if already used
    if (invite.used_at) {
      return res.status(400).json({ error: 'This invite has already been used' });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invite has expired' });
    }

    // Check if access already exists
    const existingAccess = await pool.query(
      `SELECT id FROM access_grants
       WHERE owner_id = $1 AND viewer_id = $2`,
      [invite.owner_id, viewerId]
    );

    if (existingAccess.rows.length > 0) {
      return res.status(400).json({ error: 'You already have access to this account' });
    }

    // Create access grant (access is ON by default for invites)
    await pool.query(
      `INSERT INTO access_grants
       (owner_id, viewer_id, is_active, invited_via_code, invited_at, access_granted_at)
       VALUES ($1, $2, TRUE, $3, NOW(), NOW())`,
      [invite.owner_id, viewerId, inviteCode.toUpperCase()]
    );

    // Mark invite as used
    await pool.query(
      `UPDATE invite_tokens
       SET used_at = NOW(), used_by_user_id = $1, is_active = FALSE
       WHERE id = $2`,
      [viewerId, invite.id]
    );

    // Get owner info
    const ownerInfo = await pool.query(
      'SELECT full_name FROM users WHERE id = $1',
      [invite.owner_id]
    );

    res.json({
      success: true,
      message: `You now have access to ${ownerInfo.rows[0].full_name}'s stories`,
      ownerId: invite.owner_id,
      ownerName: ownerInfo.rows[0].full_name
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});
```

#### GET `/api/invites/my-invites` - Owner views sent invites

```javascript
app.get('/api/invites/my-invites', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT
        id,
        invite_code,
        recipient_email,
        created_at,
        expires_at,
        used_at,
        is_active
       FROM invite_tokens
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [ownerId]
    );

    res.json({
      invites: result.rows
    });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ error: 'Failed to get invites' });
  }
});
```

#### GET `/api/access/my-viewers` - Owner views who has access

```javascript
app.get('/api/access/my-viewers', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT
        ag.id as grant_id,
        ag.is_active,
        ag.access_granted_at,
        ag.revoked_at,
        u.id as viewer_id,
        u.email as viewer_email,
        u.full_name as viewer_name
       FROM access_grants ag
       JOIN users u ON ag.viewer_id = u.id
       WHERE ag.owner_id = $1
       ORDER BY ag.access_granted_at DESC`,
      [ownerId]
    );

    res.json({
      viewers: result.rows
    });
  } catch (error) {
    console.error('Get viewers error:', error);
    res.status(500).json({ error: 'Failed to get viewers' });
  }
});
```

#### PUT `/api/access/toggle/:grantId` - Owner toggles viewer access ON/OFF

```javascript
app.put('/api/access/toggle/:grantId', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { grantId } = req.params;

    // Verify ownership
    const grant = await pool.query(
      'SELECT * FROM access_grants WHERE id = $1 AND owner_id = $2',
      [grantId, ownerId]
    );

    if (grant.rows.length === 0) {
      return res.status(404).json({ error: 'Access grant not found' });
    }

    const currentlyActive = grant.rows[0].is_active;

    // Toggle access
    await pool.query(
      `UPDATE access_grants
       SET is_active = $1,
           revoked_at = CASE WHEN $1 = FALSE THEN NOW() ELSE NULL END
       WHERE id = $2`,
      [!currentlyActive, grantId]
    );

    res.json({
      success: true,
      isActive: !currentlyActive,
      message: !currentlyActive ? 'Access restored' : 'Access revoked'
    });
  } catch (error) {
    console.error('Toggle access error:', error);
    res.status(500).json({ error: 'Failed to toggle access' });
  }
});
```

---

## Mobile App Implementation

### Phase 2A: Owner Invite Flow

#### File: `/Users/admin/Desktop/forever-stories/mobile/src/screens/FamilyAccessScreen.js` (NEW)

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function FamilyAccessScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadViewers();
  }, []);

  const loadViewers = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getMyViewers(token);
      setViewers(data.viewers);
    } catch (error) {
      console.error('Load viewers error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const result = await ApiService.sendInvite(token, email);

      Alert.alert(
        'Invitation Sent!',
        `Invite code: ${result.inviteCode}\n\nAn email has been sent to ${email}`,
        [{ text: 'OK' }]
      );

      setEmail('');
      loadViewers(); // Refresh list
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSending(false);
    }
  };

  const toggleAccess = async (grantId, currentlyActive, viewerName) => {
    const action = currentlyActive ? 'turn OFF' : 'turn ON';

    Alert.alert(
      'Confirm',
      `Are you sure you want to ${action} access for ${viewerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('authToken');
              await ApiService.toggleViewerAccess(token, grantId);
              loadViewers();
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Family Access</Text>
      <Text style={styles.subtitle}>
        Invite family members to view your stories and ask questions
      </Text>

      {/* Invite Section */}
      <View style={styles.inviteSection}>
        <Text style={styles.sectionTitle}>Send Invitation</Text>
        <TextInput
          style={styles.input}
          placeholder="Family member's email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.buttonDisabled]}
          onPress={sendInvite}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send Invitation</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Viewers List */}
      <View style={styles.viewersSection}>
        <Text style={styles.sectionTitle}>Who Has Access</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#e11d48" />
        ) : viewers.length === 0 ? (
          <Text style={styles.emptyText}>No family members yet</Text>
        ) : (
          viewers.map((viewer) => (
            <View key={viewer.grant_id} style={styles.viewerCard}>
              <View style={styles.viewerInfo}>
                <Text style={styles.viewerName}>{viewer.viewer_name}</Text>
                <Text style={styles.viewerEmail}>{viewer.viewer_email}</Text>
              </View>
              <Switch
                value={viewer.is_active}
                onValueChange={() =>
                  toggleAccess(viewer.grant_id, viewer.is_active, viewer.viewer_name)
                }
                trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                thumbColor={viewer.is_active ? '#e11d48' : '#f3f4f6'}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  backButton: {
    marginTop: 40,
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: '#e11d48',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  inviteSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  sendButton: {
    backgroundColor: '#e11d48',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  viewersSection: {
    marginBottom: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 20,
  },
  viewerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 10,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  viewerEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
});
```

#### Update ApiService: Add invite methods

File: `/Users/admin/Desktop/forever-stories/mobile/src/services/api.js`

```javascript
// Add to ApiService class:

async sendInvite(token, recipientEmail) {
  const response = await fetch(`${API_URL}/api/invites/send`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ recipientEmail }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send invite');
  }

  return response.json();
}

async acceptInvite(token, inviteCode) {
  const response = await fetch(`${API_URL}/api/invites/accept`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ inviteCode }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept invite');
  }

  return response.json();
}

async getMyViewers(token) {
  const response = await fetch(`${API_URL}/api/access/my-viewers`, {
    headers: getHeaders(token, false),
  });

  if (!response.ok) {
    throw new Error('Failed to get viewers');
  }

  return response.json();
}

async toggleViewerAccess(token, grantId) {
  const response = await fetch(`${API_URL}/api/access/toggle/${grantId}`, {
    method: 'PUT',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to toggle access');
  }

  return response.json();
}
```

#### Add Family Access to Account Settings

File: `/Users/admin/Desktop/forever-stories/mobile/src/screens/AccountScreen.js`

Add navigation button:

```javascript
<TouchableOpacity
  style={styles.settingButton}
  onPress={() => navigation.navigate('FamilyAccess')}
>
  <Text style={styles.settingButtonText}>👥 Family Access</Text>
</TouchableOpacity>
```

#### Update Navigation

File: `/Users/admin/Desktop/forever-stories/mobile/src/navigation/AppNavigator.js`

Add screen:

```javascript
<Stack.Screen
  name="FamilyAccess"
  component={FamilyAccessScreen}
  options={{ headerShown: false }}
/>
```

---

## Implementation Order

### Step 1: Database Migration (Day 1)
1. Create migration file `003_phase2_invites.sql`
2. Add `invite_tokens` table
3. Enhance `access_grants` table
4. Run migration and validate

### Step 2: Backend Endpoints (Day 2-3)
1. Install nodemailer
2. Create email helper functions
3. Implement `/api/invites/send` endpoint
4. Implement `/api/invites/accept` endpoint
5. Implement `/api/invites/my-invites` endpoint
6. Implement `/api/access/my-viewers` endpoint
7. Implement `/api/access/toggle/:grantId` endpoint
8. Test all endpoints with cURL

### Step 3: Mobile Owner Flow (Day 4-5)
1. Create FamilyAccessScreen.js
2. Add invite methods to ApiService
3. Add navigation to Account Settings
4. Test owner invite flow

### Step 4: Testing (Day 6-7)
1. Test owner sending invite
2. Verify email delivery
3. Test access toggle ON/OFF
4. End-to-end invite acceptance flow
5. Verify access grants work correctly

---

## Testing Checklist

- [ ] Owner can send invite via email
- [ ] Unique invite code is generated
- [ ] Email is sent with invite link and code
- [ ] Invite expires after 30 days
- [ ] Viewer can accept invite with code
- [ ] Access grant is created with is_active=TRUE
- [ ] Invite is marked as used after acceptance
- [ ] Owner can view list of viewers
- [ ] Owner can toggle access ON/OFF
- [ ] Access toggle updates is_active and revoked_at correctly
- [ ] Toggled-off viewer cannot view stories or submit questions

---

## Phase 2 Success Criteria

✅ Database has invite_tokens table
✅ Backend has all 5 invite/access endpoints
✅ Email service is configured and working
✅ Mobile app has Family Access screen
✅ Owner can send invites and manage access
✅ Access can be toggled ON/OFF per viewer
✅ All endpoints properly secured with authenticateToken

---

*End of Phase 2 Plan*
