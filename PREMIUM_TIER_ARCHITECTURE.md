# Forever Stories - Premium Tier Architecture & Compatibility

## Premium Features Planned

1. **AI Persona** - Chat with AI trained on user's stories
2. **Unlimited Storage** - More than 20 stories (free tier limit)
3. **Physical Book** - Print-on-demand book of all stories

---

## How This Affects Platform Choice

### Summary: Railway is STILL the Best Choice ✅

**Good news:** All three platforms (Railway, Heroku, DigitalOcean) can support premium features equally well. The limiting factor is **not** the hosting platform—it's the payment processor and third-party services you'll integrate.

### Why Deployment Platform Doesn't Matter Much Here

**Premium features require:**
- Payment processing → **Stripe** (works with all platforms)
- Subscription management → **Stripe Billing** (platform-agnostic)
- Book printing → **Print-on-demand API** (external service)
- AI Persona → **Anthropic API** (already using, works everywhere)
- Storage limits → **Database logic** (works on any platform)

**All of these are external services that work the same regardless of hosting.**

---

## Premium Tier Implementation Plan

### 1. Payment Processing: Stripe

**Why Stripe?**
- Industry standard for SaaS subscriptions
- Excellent mobile SDK (React Native Stripe)
- Handles recurring billing automatically
- PCI compliant (you don't handle card data)
- Works with Railway, Heroku, DigitalOcean equally
- iOS/Android in-app purchase integration possible

**Pricing Model Recommendation:**
```
Free Tier:
- Up to 20 stories
- Basic prompts
- View stories
- Share with loved ones (read-only)
- ✗ No AI Persona
- ✗ No physical book

Premium Tier: $4.99/month or $49/year
- Unlimited stories
- AI Persona chat (powered by your stories)
- Physical book purchase (additional cost: $29-49)
- Priority support
- Download all stories as PDF
- Advanced prompts & themes
```

**Alternative: In-App Purchases (Apple/Google)**
```
Free Tier: Same as above

Premium Options:
- AI Persona: $2.99/month
- Unlimited Stories: $1.99/month
- Physical Book: $39.99 one-time per book
- Everything Bundle: $4.99/month

Note: Apple takes 30% cut, Google takes 15%
```

---

### 2. Database Schema Changes for Premium Tiers

**Add to users table:**
```sql
ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free';
-- Values: 'free', 'premium', 'lifetime'

ALTER TABLE users ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'active';
-- Values: 'active', 'canceled', 'past_due', 'trialing'

ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100);
ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(100);
ALTER TABLE users ADD COLUMN subscription_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
```

**Create subscriptions table (optional but recommended):**
```sql
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    tier VARCHAR(20) NOT NULL, -- 'free', 'premium'
    status VARCHAR(20) NOT NULL, -- 'active', 'canceled', 'past_due', 'trialing'
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);
```

---

### 3. Backend API Changes

**New endpoints needed:**

```javascript
// server.js additions

// ============================================================================
// SUBSCRIPTION & BILLING
// ============================================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create checkout session for premium subscription
app.post('/api/subscriptions/create-checkout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { priceId, successUrl, cancelUrl } = req.body;

    // Get or create Stripe customer
    let stripeCustomerId = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );

    if (!stripeCustomerId.rows[0]?.stripe_customer_id) {
      const user = await pool.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
      const customer = await stripe.customers.create({
        email: user.rows[0].email,
        name: user.rows[0].full_name,
        metadata: { userId }
      });

      await pool.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, userId]
      );
      stripeCustomerId = customer.id;
    } else {
      stripeCustomerId = stripeCustomerId.rows[0].stripe_customer_id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId, // Stripe Price ID
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook handler (for subscription updates)
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle events
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      await pool.query(
        `UPDATE users SET
         subscription_tier = 'premium',
         subscription_status = $1,
         stripe_subscription_id = $2,
         subscription_ends_at = $3
         WHERE stripe_customer_id = $4`,
        [subscription.status, subscription.id, new Date(subscription.current_period_end * 1000), subscription.customer]
      );
      break;

    case 'customer.subscription.deleted':
      const deletedSub = event.data.object;
      await pool.query(
        `UPDATE users SET
         subscription_tier = 'free',
         subscription_status = 'canceled'
         WHERE stripe_customer_id = $1`,
        [deletedSub.customer]
      );
      break;
  }

  res.json({ received: true });
});

// Get user's subscription status
app.get('/api/subscriptions/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `SELECT subscription_tier, subscription_status, subscription_ends_at,
              stripe_customer_id, stripe_subscription_id
       FROM users WHERE id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Check if user can access premium feature
async function checkPremiumAccess(userId) {
  const result = await pool.query(
    'SELECT subscription_tier, subscription_status FROM users WHERE id = $1',
    [userId]
  );

  const user = result.rows[0];
  return user.subscription_tier === 'premium' && user.subscription_status === 'active';
}

// Middleware to require premium
const requirePremium = async (req, res, next) => {
  const isPremium = await checkPremiumAccess(req.user.userId);
  if (!isPremium) {
    return res.status(403).json({
      error: 'Premium subscription required',
      upgrade_url: '/premium'
    });
  }
  next();
};
```

---

### 4. Feature Gating

**Story Limit Enforcement:**
```javascript
// In POST /api/prompts/respond endpoint
app.post('/api/prompts/respond', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user has reached free tier limit
    const isPremium = await checkPremiumAccess(userId);

    if (!isPremium) {
      const storyCount = await pool.query(
        'SELECT COUNT(*) FROM prompt_responses WHERE user_id = $1',
        [userId]
      );

      if (parseInt(storyCount.rows[0].count) >= 20) {
        return res.status(403).json({
          error: 'Story limit reached',
          message: 'Upgrade to Premium for unlimited stories',
          limit: 20,
          upgrade_required: true
        });
      }
    }

    // Continue with normal response creation...
  } catch (error) {
    res.status(500).json({ error: 'Failed to save response' });
  }
});
```

**AI Persona Access:**
```javascript
// In POST /api/ai/chat endpoint
app.post('/api/ai/chat', authenticateToken, requirePremium, async (req, res) => {
  // AI persona chat logic
  // requirePremium middleware blocks non-premium users
});
```

---

### 5. Physical Book Generation

**Option A: Blurb API (Best for Quality)**
- High-quality print books
- Professional binding
- API integration
- Cost: ~$15-25 per book + shipping
- Ships directly to customer

**Option B: Lulu API**
- Similar to Blurb
- Slightly cheaper (~$12-20)
- Good quality
- API available

**Option C: PrintFul**
- Cheaper option (~$10-15)
- Fast turnaround
- Good for prototypes

**Implementation:**
```javascript
// New endpoint for book order
app.post('/api/books/create', authenticateToken, requirePremium, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1. Fetch all user stories
    const stories = await pool.query(
      `SELECT prompt_text, response_text, created_at
       FROM prompt_responses
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    // 2. Generate PDF/InDesign file
    // Use library like pdfkit or call external service
    const bookPdf = await generateBookPDF(stories.rows, userId);

    // 3. Upload to Blurb/Lulu API
    const bookOrder = await blurbAPI.createBook({
      title: "My Life Stories",
      author: req.user.fullName,
      pdf: bookPdf,
      // ... other options
    });

    // 4. Create Stripe payment for book
    const bookPrice = 3900; // $39.00 in cents
    const paymentIntent = await stripe.paymentIntents.create({
      amount: bookPrice,
      currency: 'usd',
      customer: req.user.stripeCustomerId,
      metadata: {
        userId,
        bookOrderId: bookOrder.id,
        type: 'physical_book'
      }
    });

    // 5. Save order to database
    await pool.query(
      `INSERT INTO book_orders
       (user_id, book_order_id, status, amount, payment_intent_id)
       VALUES ($1, $2, 'pending', $3, $4)`,
      [userId, bookOrder.id, bookPrice, paymentIntent.id]
    );

    res.json({
      success: true,
      paymentIntentSecret: paymentIntent.client_secret,
      bookOrderId: bookOrder.id
    });
  } catch (error) {
    console.error('Book creation error:', error);
    res.status(500).json({ error: 'Failed to create book order' });
  }
});
```

**Database schema for book orders:**
```sql
CREATE TABLE book_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    book_order_id VARCHAR(100), -- Blurb/Lulu order ID
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, printing, shipped, delivered
    amount INTEGER NOT NULL, -- in cents
    payment_intent_id VARCHAR(100),
    shipping_address JSONB,
    tracking_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_book_orders_user ON book_orders(user_id);
CREATE INDEX idx_book_orders_status ON book_orders(status);
```

---

## Platform Compatibility Analysis

### Railway ✅ STILL RECOMMENDED
**Premium Feature Support:**
- ✅ Stripe webhooks (HTTPS required) - Automatic SSL
- ✅ Background jobs for book generation - Supported
- ✅ File storage for PDFs - Can use S3 (already configured)
- ✅ Increased compute for AI - Easy to upgrade RAM/CPU
- ✅ Cron jobs for subscription checks - Already using

**Scaling for Premium:**
- Hobby ($5/mo): 0-100 premium users ✅
- Pro ($20/mo): 100-1000 premium users ✅
- Scale Plan ($50+/mo): 1000+ premium users ✅

**No issues with premium features.**

---

### Heroku ✅ Also Fine
**Premium Feature Support:**
- ✅ All same capabilities as Railway
- ✅ Dynos scale easily
- ✅ Many Stripe integration guides available
- ✅ Add-ons for background jobs (Sidekiq, Redis)

**Cost:** ~$20-40/month for premium-ready setup (vs $5 Railway)

---

### DigitalOcean ✅ Also Works
**Premium Feature Support:**
- ✅ Full control over infrastructure
- ✅ Can run background workers separately
- ✅ Easy to add Redis for job queues
- ✅ Scalable to any size

**Complexity:** Higher (need to manage more yourself)

---

## Updated Recommendation: Railway

**Why Railway STILL wins for premium features:**

1. **Cost Efficiency for Launch**
   - Month 1-6: $5/month (building user base)
   - Month 6-12: $20/month (if you have 100+ premium users)
   - By the time you need Heroku's scale, you'll have revenue to afford it

2. **Easy Stripe Integration**
   - Stripe works identically on all platforms
   - Railway's automatic SSL makes webhooks trivial
   - No difference in implementation

3. **Physical Book Generation**
   - External service (Blurb/Lulu API)
   - Works same on any platform
   - Processing happens on their servers, not yours

4. **AI Persona Scaling**
   - You're already using Anthropic API
   - API calls happen externally
   - Railway just needs to handle HTTP requests (easy)
   - If AI traffic grows, just upgrade Railway plan ($20-50/mo)

5. **Migration Path**
   - Start: Railway Hobby ($5/mo) - 0-50 users
   - Growth: Railway Pro ($20/mo) - 50-500 users
   - Scale: Railway Scale ($50/mo) or migrate to Heroku - 500+ users
   - By then, you'll have revenue to afford it

---

## Environment Variables to Add

```bash
# Stripe (add to .env)
STRIPE_SECRET_KEY=sk_live_...  # Get from Stripe dashboard
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Get when creating webhook

# Stripe Price IDs (create in Stripe dashboard)
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_...

# Book printing (choose one)
BLURB_API_KEY=...
LULU_API_KEY=...
PRINTFUL_API_KEY=...

# Feature flags
FREE_TIER_STORY_LIMIT=20
ENABLE_PREMIUM_FEATURES=true
```

---

## Mobile App Changes for Premium

### Add Stripe SDK
```bash
cd expo-mobile
npx expo install @stripe/stripe-react-native
```

### Premium Paywall Screen
**New file: `expo-mobile/src/screens/PremiumScreen.js`**
```javascript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

export default function PremiumScreen({ navigation }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handleUpgrade = async () => {
    // 1. Create checkout session on backend
    const response = await ApiService.createCheckoutSession(token);

    // 2. Initialize payment sheet
    const { error } = await initPaymentSheet({
      merchantDisplayName: 'Forever Stories',
      customerId: response.customerId,
      customerEphemeralKeySecret: response.ephemeralKey,
      paymentIntentClientSecret: response.paymentIntent,
    });

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    // 3. Present payment sheet
    const { error: paymentError } = await presentPaymentSheet();

    if (!paymentError) {
      Alert.alert('Success', 'Welcome to Premium!');
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Forever Stories Premium</Text>

      <View style={styles.feature}>
        <Text style={styles.featureIcon}>🤖</Text>
        <Text style={styles.featureText}>AI Persona - Chat with your stories</Text>
      </View>

      <View style={styles.feature}>
        <Text style={styles.featureIcon}>∞</Text>
        <Text style={styles.featureText}>Unlimited Stories</Text>
      </View>

      <View style={styles.feature}>
        <Text style={styles.featureIcon}>📖</Text>
        <Text style={styles.featureText}>Physical Book of Your Stories</Text>
      </View>

      <Text style={styles.price}>$4.99/month or $49/year</Text>

      <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
        <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Story Limit Warning
**In DailyPromptScreen.js:**
```javascript
const checkStoryLimit = async () => {
  const stats = await ApiService.getUserStats(token);
  const subscription = await ApiService.getSubscriptionStatus(token);

  if (subscription.tier === 'free' && stats.totalResponses >= 19) {
    Alert.alert(
      'Story Limit Approaching',
      `You've written ${stats.totalResponses} stories. Upgrade to Premium for unlimited stories!`,
      [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => navigation.navigate('Premium') }
      ]
    );
  }

  if (subscription.tier === 'free' && stats.totalResponses >= 20) {
    Alert.alert(
      'Story Limit Reached',
      'Upgrade to Premium to continue writing stories.',
      [
        { text: 'Upgrade', onPress: () => navigation.navigate('Premium') }
      ]
    );
    return false; // Block writing
  }

  return true; // Allow writing
};
```

---

## Revenue Projections

### Conservative Scenario
```
Month 1: 100 total users, 5 premium (5%) = $25/month revenue
Month 3: 300 total users, 20 premium (6.7%) = $100/month
Month 6: 500 total users, 40 premium (8%) = $200/month
Month 12: 1000 total users, 100 premium (10%) = $500/month

Costs (Railway + Stripe):
- Railway: $5-20/month
- Stripe fees: 2.9% + $0.30 per transaction
- Net profit month 12: ~$450/month
```

### Optimistic Scenario
```
Month 6: 2000 total users, 200 premium (10%) = $1000/month
Month 12: 5000 total users, 750 premium (15%) = $3750/month

Costs:
- Railway Pro: $20-50/month
- Stripe fees: ~$120/month
- Net profit month 12: ~$3500/month
```

---

## Timeline to Add Premium Features

### Phase 1: Subscription Infrastructure (Week 1-2)
- [ ] Sign up for Stripe account
- [ ] Create subscription products in Stripe
- [ ] Add Stripe SDK to mobile app
- [ ] Build PremiumScreen component
- [ ] Add database fields for subscriptions
- [ ] Create backend subscription endpoints
- [ ] Set up Stripe webhooks
- [ ] Test subscription flow end-to-end

### Phase 2: Feature Gating (Week 2-3)
- [ ] Implement story limit check
- [ ] Add premium middleware to protected endpoints
- [ ] Add AI Persona gate
- [ ] Update mobile app to show upgrade prompts
- [ ] Test free vs premium access

### Phase 3: Physical Book (Week 4-6)
- [ ] Research Blurb/Lulu/PrintFul APIs
- [ ] Build PDF generation from stories
- [ ] Create book order flow
- [ ] Add book purchase screen
- [ ] Test end-to-end book ordering

### Phase 4: Polish & Launch (Week 7-8)
- [ ] Add pricing page
- [ ] Create premium marketing materials
- [ ] Set up analytics for conversion tracking
- [ ] Soft launch to existing users
- [ ] Gather feedback and iterate

**Total time: 6-8 weeks**

---

## Final Answer: Railway is Still Best ✅

**Your premium features don't change the platform recommendation.**

All premium features are:
- **Payment processing**: External (Stripe)
- **AI Persona**: External (Anthropic API)
- **Book printing**: External (Blurb/Lulu)
- **Storage limits**: Database logic (works anywhere)

Railway can handle all of this for $5-20/month initially, with easy scaling to $50+/month as you grow.

**Decision:** Stick with Railway. It's perfect for your roadmap.

Ready to deploy to Railway now?
