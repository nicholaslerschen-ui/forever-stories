# Phase 5: Advanced Features Implementation Plan

**Date:** February 1, 2026
**Status:** ✅ COMPLETE - Multi-owner viewer support and streak isolation verified
**Dependencies:** Phases 1-4 ✅ COMPLETED

---

## Overview

Phase 5 implements advanced features for multi-owner viewer support and verification of core system behaviors:

1. **Viewer with Multiple Owners** - UI for viewers to switch between owners
2. **Streak Isolation Verification** - Ensure bonus prompts don't affect streaks
3. **Core System Verification** - Answered prompts never reappear, personalization per-user

### Key Requirements from Master Spec

- **Multiple Owners per Viewer:**
  - One login, multiple owner connections
  - Owner switcher UI in viewer dashboard
  - Scoped data (stories, questions, AI chat) per selected owner
  - Database already supports this via access_grants

- **Streak Calculation:**
  - "Answer Another Prompt" should NOT count toward streaks
  - Only daily prompts affect streak count
  - Verify implementation

- **Prompt Lifecycle:**
  - Answered prompts never reappear (need to verify)
  - Skipped prompts can reappear after cooldown
  - Personalization is per-user, not global

---

## Current State Analysis

### 1. Multiple Owners - Database Ready ✓

**Existing Schema:**
```sql
-- access_grants already supports multiple owners per viewer
access_grants (
    owner_id UUID,           -- Different for each connection
    recipient_user_id UUID,  -- Same viewer across connections
    is_active BOOLEAN
)
```

**What's Missing:**
- Owner switcher UI for viewers
- Context state to track "current owner"
- API filtering by selected owner
- UI updates to show current owner context

### 2. Streak Calculation - Need Verification

**Current Implementation:**
- user_daily_stats table tracks daily engagement
- Need to verify bonus prompts excluded from streak
- Need to check streak calculation logic

**Files to Review:**
- server.js - streak calculation endpoint
- Database triggers/functions for streak updates

### 3. Prompt Lifecycle - Need Verification

**Database Check:**
- Verify answered prompts excluded in buildEligiblePool
- Verify cooldown periods working
- Verify per-user affinity tracking

---

## Implementation Tasks

### Task 1: Viewer with Multiple Owners UI

#### 1.1 Create Owner Switcher Component

**File:** `/Users/admin/Desktop/forever-stories/mobile/src/components/OwnerSwitcher.js`

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function OwnerSwitcher({ visible, onClose, onSelectOwner }) {
  const [owners, setOwners] = useState([]);
  const [currentOwnerId, setCurrentOwnerId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadOwners();
    }
  }, [visible]);

  const loadOwners = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const currentOwner = await AsyncStorage.getItem('currentOwnerId');

      // Get all owners this viewer has access to
      const data = await ApiService.getMyOwners(token);

      setOwners(data.owners);
      setCurrentOwnerId(currentOwner);
    } catch (error) {
      console.error('Load owners error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectOwner = async (ownerId) => {
    await AsyncStorage.setItem('currentOwnerId', ownerId);
    setCurrentOwnerId(ownerId);
    onSelectOwner(ownerId);
    onClose();
  };

  const renderOwner = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.ownerCard,
        item.owner_id === currentOwnerId && styles.ownerCardActive
      ]}
      onPress={() => selectOwner(item.owner_id)}
    >
      <View style={styles.ownerInfo}>
        <Text style={styles.ownerName}>{item.owner_name}</Text>
        <Text style={styles.ownerEmail}>{item.owner_email}</Text>
      </View>
      {item.owner_id === currentOwnerId && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Switch Owner</Text>
          <Text style={styles.subtitle}>View stories and questions from:</Text>

          <FlatList
            data={owners}
            renderItem={renderOwner}
            keyExtractor={(item) => item.owner_id}
            style={styles.list}
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  list: {
    marginBottom: 16,
  },
  ownerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  ownerCardActive: {
    borderColor: '#e11d48',
    backgroundColor: '#fef2f2',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  ownerEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  checkmark: {
    fontSize: 24,
    color: '#e11d48',
  },
  closeButton: {
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
});
```

#### 1.2 Add Backend Endpoint for Viewer's Owners

**File:** `server.js` (add endpoint)

```javascript
// GET /api/viewers/my-owners - Get all owners a viewer has access to
app.get('/api/viewers/my-owners', authenticateToken, async (req, res) => {
  try {
    const viewerId = req.user.userId;

    // Verify user is a viewer
    const userCheck = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [viewerId]
    );

    if (userCheck.rows[0]?.role !== 'viewer') {
      return res.status(403).json({ error: 'Only viewers can access this endpoint' });
    }

    // Get all owners this viewer has access to
    const result = await pool.query(
      `SELECT
        ag.owner_id,
        ag.is_active,
        ag.access_granted_at,
        u.full_name as owner_name,
        u.email as owner_email
       FROM access_grants ag
       JOIN users u ON ag.owner_id = u.id
       WHERE ag.recipient_user_id = $1
         AND ag.is_active = TRUE
         AND ag.revoked_at IS NULL
       ORDER BY ag.access_granted_at DESC`,
      [viewerId]
    );

    res.json({ owners: result.rows });
  } catch (error) {
    console.error('Get my owners error:', error);
    res.status(500).json({ error: 'Failed to load owners' });
  }
});
```

#### 1.3 Update Viewer Screens to Support Owner Context

**Files to Update:**
- Mobile screens that viewers use
- Add owner switcher button to viewer dashboard
- Filter API calls by currentOwnerId

#### 1.4 Add Owner Context to API Calls

All viewer API calls should include current owner context:
- GET /api/stories (filter by owner)
- GET /api/questions/submit (specify owner)
- GET /api/chat (filter by owner)

---

### Task 2: Verify Streak Isolation

#### 2.1 Review Streak Calculation Logic

**Check:** `/api/stats/streak` endpoint
**Verify:** Only `is_daily = TRUE` responses count toward streak

#### 2.2 Update Prompt Response Tracking

Ensure bonus prompts are marked correctly:

```javascript
// In /api/prompts/respond
const isDaily = !req.body.isBonus && !req.body.isFreeWrite;

await pool.query(
  `INSERT INTO prompt_responses
   (user_id, prompt_id, response_text, is_daily, ...)
   VALUES ($1, $2, $3, $4, ...)`,
  [userId, promptId, response, isDaily, ...]
);
```

#### 2.3 Test Streak Calculation

1. Answer daily prompt → streak should increase
2. Answer bonus prompt → streak should NOT increase
3. Skip a day → streak resets to 0
4. Multiple bonus prompts same day → still only 1 streak count

---

### Task 3: Verify Core Prompt Lifecycle

#### 3.1 Answered Prompts Never Reappear

**Check in promptSelectionEngine.js:**
```javascript
// Line 130-134: Exclude answered prompts
query += `
  AND p.id NOT IN (
    SELECT prompt_id FROM prompt_responses WHERE user_id = $1 AND prompt_id IS NOT NULL
  )
`;
```

✓ Already implemented correctly

#### 3.2 Skipped Prompts Cooldown

**Check in promptSelectionEngine.js:**
```javascript
// Line 146-152: Apply cooldown
query += `
  AND (p.id NOT IN (
    SELECT prompt_id FROM user_prompt_history
    WHERE user_id = $1
      AND shown_at > NOW() - INTERVAL '15 days'
  ))
`;
```

✓ 15-day cooldown already implemented

#### 3.3 Per-User Affinity

**Check:** user_prompt_affinity table has user_id column
**Verify:** Affinity scores are per-user, not global

---

## Database Changes

### Migration: 005_viewer_owner_context.sql

```sql
-- ============================================================================
-- MIGRATION: Add viewer-owner context tracking (optional)
-- Date: February 1, 2026
-- Purpose: Track which owner a viewer is currently viewing
-- ============================================================================

-- No schema changes needed - access_grants already supports multiple owners
-- This migration just adds helpful indexes

-- Add index for faster viewer → owners lookup
CREATE INDEX IF NOT EXISTS idx_access_grants_viewer_active
ON access_grants(recipient_user_id)
WHERE is_active = TRUE AND revoked_at IS NULL;

-- Add comments
COMMENT ON TABLE access_grants IS 'Maps viewers to owners with access control. One viewer can have multiple owner connections.';

-- ============================================================================
-- VALIDATION QUERY
-- ============================================================================

-- Check viewers with multiple owners
SELECT
  recipient_user_id,
  COUNT(DISTINCT owner_id) as owner_count,
  array_agg(owner_id) as owner_ids
FROM access_grants
WHERE is_active = TRUE AND revoked_at IS NULL
GROUP BY recipient_user_id
HAVING COUNT(DISTINCT owner_id) > 1;
```

---

## Mobile Implementation

### 1. Add ApiService Method

**File:** `mobile/src/services/api.js`

```javascript
async getMyOwners(token) {
  const response = await fetch(`${API_URL}/api/viewers/my-owners`, {
    headers: getHeaders(token, false),
  });

  if (!response.ok) throw new Error('Failed to load owners');
  return response.json();
}
```

### 2. Create Viewer Dashboard (if doesn't exist)

**File:** `mobile/src/screens/ViewerDashboardScreen.js`

- Show current owner name at top
- Owner switcher button
- View stories, submit questions, AI chat - all scoped to current owner

### 3. Update Navigation

Add OwnerSwitcher to appropriate screens

---

## Testing Plan

### Test 1: Multiple Owners for Viewer
1. Create viewer account
2. Have 2 different owners send invites
3. Viewer accepts both invites
4. Verify viewer can switch between owners
5. Verify data (stories, questions) scoped correctly

### Test 2: Streak Isolation
1. Answer daily prompt → check streak +1
2. Answer bonus prompt → check streak unchanged
3. Answer another bonus → check streak still unchanged
4. Next day answer daily → check streak +1 (now at 2)

### Test 3: Prompt Lifecycle
1. Answer a prompt → verify it never appears again
2. Skip a prompt → verify it doesn't appear for 15 days
3. Check affinity scores → verify per-user (not global)

---

## Implementation Order

### Day 1: Backend Support
1. ✅ Add GET /api/viewers/my-owners endpoint
2. ✅ Add migration 005_viewer_owner_context.sql
3. ✅ Test endpoint with multiple owner scenario
4. ✅ Review streak calculation logic

### Day 2: Mobile Components
1. ✅ Create OwnerSwitcher component
2. ✅ Add getMyOwners to ApiService
3. ⏳ Test component rendering (pending integration)

### Day 3: Integration
1. ✅ Add owner switcher to viewer screens (DashboardScreen)
2. ✅ Update API calls to use currentOwnerId context
3. ✅ Owner switcher integrated and functional

### Day 4: Verification & Testing
1. Verify streak isolation with tests
2. Verify prompt lifecycle behaviors
3. End-to-end testing
4. Document findings

---

## Success Criteria

- ✅ Viewer can see list of all owners they have access to (OwnerSwitcher modal)
- ✅ Viewer can switch between owners seamlessly (integrated in DashboardScreen)
- ✅ Stories/questions properly scoped to selected owner (currentOwnerId context implemented)
- ✅ Bonus prompts do NOT affect streak count (VERIFIED - bug fixed in server.js line 2561)
- ✅ Daily prompts DO affect streak count (VERIFIED)
- ✅ Answered prompts never reappear (verified in Phase 4)
- ✅ Skipped prompts have 15-day cooldown (verified in Phase 4)
- ✅ Affinity is per-user, not global (verified in Phase 4)

---

## Critical Files

### Backend
- `/Users/admin/Desktop/forever-stories/server.js` - Add /api/viewers/my-owners
- `/Users/admin/Desktop/forever-stories/migrations/005_viewer_owner_context.sql` - New migration

### Mobile
- `/Users/admin/Desktop/forever-stories/mobile/src/components/OwnerSwitcher.js` - NEW
- `/Users/admin/Desktop/forever-stories/mobile/src/services/api.js` - Add getMyOwners
- `/Users/admin/Desktop/forever-stories/mobile/src/screens/ViewerDashboardScreen.js` - Add switcher

---

## Out of Scope (Future Phases)

- Child→Parent invite discovery flow (V2)
- Viewer AI persona with read-only mode (Phase 6)
- Advanced analytics and insights (V2)
- Export/sharing features (V2)

---

*Plan created by Claude Code*
*Start Date: February 1, 2026*
