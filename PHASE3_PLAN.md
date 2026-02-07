# Phase 3: Family Questions Implementation Plan

**Date:** February 1, 2026
**Status:** ✅ COMPLETE
**Dependencies:** Phase 1 (Onboarding), Phase 2 (Invite System) ✅ COMPLETED

---

## Overview

Phase 3 implements the family questions feature that allows:
1. **Viewers** to submit questions for the owner to answer
2. **Owners** to see questions from family in their daily prompt flow
3. **System** to enforce 3 pending question limit per owner
4. **UI** to display family questions prominently

### Key Requirements from Master Spec

- Family questions appear **AS** daily prompts (replace system prompts when available)
- Questions appear in **FIFO order** (first-in-first-out)
- **Priority:** Family questions > System prompts
- **Limit:** Maximum 3 pending questions per owner at any time
- **Blocked during onboarding:** Already implemented in Phase 1 ✅
- **Show submitter:** Owner sees who asked the question

---

## Database Schema (Already Exists)

The `submitted_questions` table was already created in initial schema:

```sql
CREATE TABLE submitted_questions (
    id UUID PRIMARY KEY,
    story_owner_id UUID REFERENCES users(id),
    submitter_user_id UUID REFERENCES users(id),
    submitter_email VARCHAR(255),
    question_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP,
    answered_at TIMESTAMP
);

CREATE INDEX idx_submitted_questions_pending_fifo
ON submitted_questions(story_owner_id, created_at ASC)
WHERE status = 'pending';
```

**No migration needed** - schema is already compliant!

---

## Backend Implementation

### File: `/Users/admin/Desktop/forever-stories/server.js`

### 1. Enforce 3 Pending Question Limit

Update `/api/questions/submit` endpoint to check count before allowing submission:

```javascript
app.post('/api/questions/submit', authenticateToken, async (req, res) => {
  try {
    const submitterId = req.user.userId;
    const submitterEmail = req.user.email;
    const { ownerId, questionText } = req.body;

    if (!ownerId || !questionText || !questionText.trim()) {
      return res.status(400).json({ error: 'Owner ID and question text required' });
    }

    // Verify submitter has active access to this owner
    const accessCheck = await pool.query(
      `SELECT id FROM access_grants
       WHERE owner_id = $1
         AND recipient_user_id = $2
         AND is_active = TRUE
         AND revoked_at IS NULL`,
      [ownerId, submitterId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to submit questions to this owner' });
    }

    // SPEC REQUIREMENT: Enforce 3 pending question limit
    const pendingCount = await pool.query(
      `SELECT COUNT(*) as count
       FROM submitted_questions
       WHERE story_owner_id = $1 AND status = 'pending'`,
      [ownerId]
    );

    const currentPending = parseInt(pendingCount.rows[0].count);

    if (currentPending >= 3) {
      return res.status(400).json({
        error: 'Maximum 3 pending questions reached. Please wait for the owner to answer existing questions.'
      });
    }

    // Submit question
    const result = await pool.query(
      `INSERT INTO submitted_questions
       (story_owner_id, submitter_user_id, submitter_email, question_text, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING *`,
      [ownerId, submitterId, submitterEmail, questionText]
    );

    res.json({
      success: true,
      question: result.rows[0]
    });
  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});
```

### 2. Get Pending Questions Count

Add endpoint for owner to see how many pending questions they have:

```javascript
app.get('/api/questions/pending-count', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM submitted_questions
       WHERE story_owner_id = $1 AND status = 'pending'`,
      [ownerId]
    );

    res.json({
      count: parseInt(result.rows[0].count)
    });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ error: 'Failed to get pending count' });
  }
});
```

### 3. Get Pending Questions List for Owner

Add endpoint to view all pending family questions:

```javascript
app.get('/api/questions/pending', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId;

    const result = await pool.query(
      `SELECT
        sq.id,
        sq.question_text,
        sq.submitter_email,
        sq.created_at,
        u.full_name as submitter_name
       FROM submitted_questions sq
       LEFT JOIN users u ON sq.submitter_user_id = u.id
       WHERE sq.story_owner_id = $1 AND sq.status = 'pending'
       ORDER BY sq.created_at ASC`,
      [ownerId]
    );

    res.json({
      questions: result.rows
    });
  } catch (error) {
    console.error('Get pending questions error:', error);
    res.status(500).json({ error: 'Failed to get pending questions' });
  }
});
```

---

## Mobile App Implementation

### Phase 3A: Viewer Question Submission

#### File: `/Users/admin/Desktop/forever-stories/mobile/src/screens/ViewerSubmitQuestionScreen.js` (NEW)

```javascript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function ViewerSubmitQuestionScreen({ route, navigation }) {
  const { ownerId, ownerName } = route.params;
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitQuestion = async () => {
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      await ApiService.submitQuestion(token, ownerId, question);

      Alert.alert(
        'Question Submitted!',
        `Your question has been submitted to ${ownerName}. They will answer it as part of their daily prompts.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Ask {ownerName}</Text>
      <Text style={styles.subtitle}>
        Submit a question for {ownerName} to answer. They'll see it as one of their daily prompts.
      </Text>

      <Text style={styles.label}>Your Question</Text>
      <TextInput
        style={styles.input}
        placeholder="What would you like to know?"
        value={question}
        onChangeText={setQuestion}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <Text style={styles.hint}>
        💡 Tip: Ask about specific memories, experiences, or stories you'd like to hear about.
      </Text>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.buttonDisabled]}
        onPress={submitQuestion}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Question</Text>
        )}
      </TouchableOpacity>
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    minHeight: 150,
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 30,
    fontStyle: 'italic',
  },
  submitButton: {
    backgroundColor: '#e11d48',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
```

### Phase 3B: Owner Dashboard Updates

#### Update DashboardScreen.js to show family questions count

```javascript
// Add state
const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0);

// Load pending questions count
const loadPendingQuestions = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const data = await ApiService.getPendingQuestionsCount(token);
    setPendingQuestionsCount(data.count);
  } catch (error) {
    console.error('Failed to load pending questions:', error);
  }
};

useEffect(() => {
  loadUserData();
  checkDailyPromptStatus();
  loadPendingQuestions(); // NEW
}, []);

// Add "From Family" section BEFORE the main prompt button
{pendingQuestionsCount > 0 && (
  <TouchableOpacity
    style={styles.familyQuestionsCard}
    onPress={() => navigation.navigate('FamilyQuestions')}
  >
    <Text style={styles.familyQuestionsTitle}>
      📬 Questions from Family ({pendingQuestionsCount})
    </Text>
    <Text style={styles.familyQuestionsSubtitle}>
      Your family has submitted questions for you to answer
    </Text>
    <Text style={styles.familyQuestionsLink}>View questions →</Text>
  </TouchableOpacity>
)}
```

**Styles:**
```javascript
familyQuestionsCard: {
  backgroundColor: '#fef2f2',
  borderWidth: 2,
  borderColor: '#e11d48',
  padding: 20,
  borderRadius: 12,
  marginBottom: 20,
},
familyQuestionsTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#e11d48',
  marginBottom: 8,
},
familyQuestionsSubtitle: {
  fontSize: 14,
  color: '#666',
  marginBottom: 10,
},
familyQuestionsLink: {
  fontSize: 16,
  color: '#e11d48',
  fontWeight: '600',
},
```

### Phase 3C: Family Questions Queue Screen

#### File: `/Users/admin/Desktop/forever-stories/mobile/src/screens/FamilyQuestionsScreen.js` (NEW)

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

export default function FamilyQuestionsScreen({ navigation }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const data = await ApiService.getPendingQuestions(token);
      setQuestions(data.questions);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const renderQuestion = ({ item, index }) => (
    <View style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <Text style={styles.questionNumber}>Question #{index + 1}</Text>
        <Text style={styles.questionDate}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={styles.questionFrom}>From: {item.submitter_name || item.submitter_email}</Text>
      <Text style={styles.questionText}>{item.question_text}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Questions from Family</Text>
      <Text style={styles.subtitle}>
        {questions.length === 0
          ? 'No pending questions right now'
          : `${questions.length} question${questions.length > 1 ? 's' : ''} waiting to be answered`}
      </Text>

      {questions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>📭</Text>
          <Text style={styles.emptyTitle}>No Questions Yet</Text>
          <Text style={styles.emptySubtitle}>
            When family members submit questions, they'll appear here and as daily prompts.
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.infoText}>
            💡 These questions will appear as your daily prompts in FIFO order (first-in, first-out)
          </Text>
          <FlatList
            data={questions}
            renderItem={renderQuestion}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  questionCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e11d48',
    textTransform: 'uppercase',
  },
  questionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  questionFrom: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
```

### Phase 3D: Update DailyPromptScreen

Show who asked the question when it's a family question:

```javascript
// In the prompt display section, add:
{prompt?.isSubmittedQuestion && (
  <View style={styles.familyQuestionBadge}>
    <Text style={styles.familyQuestionText}>
      📬 Question from {prompt.submitterName || prompt.submitterEmail}
    </Text>
  </View>
)}

// Styles:
familyQuestionBadge: {
  backgroundColor: '#fef2f2',
  borderWidth: 1,
  borderColor: '#fca5a5',
  padding: 12,
  borderRadius: 8,
  marginBottom: 20,
  flexDirection: 'row',
  alignItems: 'center',
},
familyQuestionText: {
  fontSize: 14,
  color: '#e11d48',
  fontWeight: '600',
},
```

---

## API Service Updates

### File: `/Users/admin/Desktop/forever-stories/mobile/src/services/api.js`

```javascript
// Add these methods to ApiService class:

async getPendingQuestionsCount(token) {
  const response = await fetch(`${API_URL}/api/questions/pending-count`, {
    headers: getHeaders(token, false),
  });

  if (!response.ok) throw new Error('Failed to get pending questions count');
  return response.json();
}

async getPendingQuestions(token) {
  const response = await fetch(`${API_URL}/api/questions/pending`, {
    headers: getHeaders(token, false),
  });

  if (!response.ok) throw new Error('Failed to get pending questions');
  return response.json();
}
```

---

## Implementation Order

### Step 1: Backend Endpoints (Day 1)
1. ✅ Update `/api/questions/submit` to enforce 3 question limit
2. ✅ Add `/api/questions/pending-count` endpoint
3. ✅ Add `/api/questions/pending` endpoint
4. ✅ Test all endpoints with cURL

### Step 2: Mobile API Layer (Day 2)
1. ✅ Add `getPendingQuestionsCount()` to ApiService
2. ✅ Add `getPendingQuestions()` to ApiService
3. ✅ Test API methods

### Step 3: Owner UI (Day 3)
1. ✅ Update DashboardScreen with family questions card
2. ✅ Create FamilyQuestionsScreen
3. ✅ Update DailyPromptScreen to show question source
4. ✅ Add navigation routes

### Step 4: Viewer UI (Day 4)
1. ✅ Create ViewerSubmitQuestionScreen
2. ✅ Add question submission flow
3. ✅ Test 3 question limit enforcement

### Step 5: Testing & Polish (Day 5)
1. ✅ Test full flow: viewer submits → owner sees → owner answers
2. ✅ Test 3 question limit (4th submission rejected)
3. ✅ Test FIFO ordering
4. ✅ Test onboarding block (already implemented)
5. ✅ UI polish and error handling

---

## Testing Checklist

- [ ] Viewer can submit question to owner they have access to
- [ ] Viewer CANNOT submit more than 3 pending questions
- [ ] Owner sees pending questions count on Dashboard
- [ ] Owner can view all pending questions in FIFO order
- [ ] Family questions appear in daily prompt flow
- [ ] Owner sees who asked the question
- [ ] After answering, question status updates to 'answered'
- [ ] Pending count decreases after answering
- [ ] Viewer without access cannot submit questions
- [ ] Family questions blocked during owner onboarding

---

## Success Criteria

✅ Viewers can submit questions to owners
✅ 3 question limit enforced
✅ Questions appear in FIFO order
✅ Owner UI shows family questions prominently
✅ Question source displayed when answering
✅ All existing Phase 1 & 2 functionality preserved

---

*End of Phase 3 Plan*
