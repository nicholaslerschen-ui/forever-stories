#!/usr/bin/env python3
"""
Update server.js with new prompt endpoints
"""

# Read current server.js
with open('/Users/admin/Desktop/forever-stories/server.js', 'r') as f:
    lines = f.readlines()

# Read the new endpoints file
with open('/Users/admin/Desktop/forever-stories/server-prompts-updates.js', 'r') as f:
    new_endpoints = f.read()

# Extract the new endpoints
new_today = []
new_next = []
new_history = []
new_gates = []

current_section = None
for line in new_endpoints.split('\n'):
    if 'Get today\'s prompt for user (UPDATED)' in line:
        current_section = 'today'
    elif 'Get next prompt (UPDATED for new schema)' in line:
        current_section = 'next'
    elif 'Get user\'s response history (UPDATED for new schema)' in line:
        current_section = 'history'
    elif 'NEW GATE MANAGEMENT ENDPOINTS' in line:
        current_section = 'gates'

    if current_section == 'today' and 'app.get(\'/api/prompts/today\'' in line:
        new_today.append(line + '\n')
        current_section = 'today_body'
    elif current_section == 'today_body':
        new_today.append(line + '\n')
        if line.strip() == '});':
            current_section = None

    elif current_section == 'next' and 'app.get(\'/api/prompts/next\'' in line:
        new_next.append(line + '\n')
        current_section = 'next_body'
    elif current_section == 'next_body':
        new_next.append(line + '\n')
        if line.strip() == '});':
            current_section = None

    elif current_section == 'history' and 'app.get(\'/api/prompts/history\'' in line:
        new_history.append(line + '\n')
        current_section = 'history_body'
    elif current_section == 'history_body':
        new_history.append(line + '\n')
        if line.strip() == '});':
            current_section = None

    elif current_section == 'gates':
        new_gates.append(line + '\n')

# Find and replace sections in server.js
result = []
i = 0
skip_until = None

while i < len(lines):
    line = lines[i]

    # Check if we should skip (we're inside a replaced section)
    if skip_until and i < skip_until:
        i += 1
        continue
    else:
        skip_until = None

    # Replace /api/prompts/today (lines 816-1025, 0-indexed: 815-1024)
    if i == 815 and '// Get today\'s prompt for user' in line:
        result.append('// Get today\'s prompt for user (UPDATED - Advanced Prompts System)\n')
        result.extend(new_today)
        skip_until = 1025
        i += 1
        continue

    # Replace /api/prompts/next (lines 1027-1064, 0-indexed: 1026-1063)
    if i == 1026 and '// Get next prompt' in line:
        result.append('// Get next prompt (UPDATED - Advanced Prompts System)\n')
        result.extend(new_next)
        skip_until = 1064
        i += 1
        continue

    # Replace /api/prompts/history (lines 1263-1285, 0-indexed: 1262-1284)
    if i == 1262 and '// Get user\'s response history' in line:
        result.append('// Get user\'s response history (UPDATED - Advanced Prompts System)\n')
        result.extend(new_history)
        result.append('\n')
        result.append('// ============================================================================\n')
        result.append('// GATE MANAGEMENT ENDPOINTS (NEW)\n')
        result.append('// ============================================================================\n')
        result.extend(new_gates)
        skip_until = 1285
        i += 1
        continue

    # Keep the line
    result.append(line)
    i += 1

# Write the updated server.js
with open('/Users/admin/Desktop/forever-stories/server.js', 'w') as f:
    f.writelines(result)

print("✅ server.js updated successfully!")
print("\nUpdated endpoints:")
print("  - /api/prompts/today (weighted selection)")
print("  - /api/prompts/next (new schema)")
print("  - /api/prompts/history (new schema)")
print("\nAdded endpoints:")
print("  - GET  /api/gates/available")
print("  - GET  /api/gates/my-gates")
print("  - POST /api/gates/unlock")
print("  - DELETE /api/gates/:gateTag")
print("\nBackup saved at: server.js.backup")
