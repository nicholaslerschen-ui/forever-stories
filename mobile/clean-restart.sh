#!/bin/bash

echo "🧹 Cleaning React Native cache..."
cd /Users/admin/Desktop/forever-stories/mobile

# Clear caches
rm -rf node_modules/.cache
watchman watch-del-all 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true

echo "✅ Cache cleared!"
echo ""
echo "📱 To restart the app:"
echo "1. Stop Metro (Ctrl+C in Metro terminal)"
echo "2. Run: npm start -- --reset-cache"
echo "3. In a new terminal, run: npx react-native run-ios"
