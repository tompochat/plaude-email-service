#!/bin/bash
# =============================================================================
# Email Service Test Commands
# =============================================================================

# Your API Key (from .env.local)
API_KEY="e0f7a2a1c85ac77a785789fcc29fbd3d8396889eba072caade2f826aea48b3d2"
BASE_URL="http://localhost:3000"

# =============================================================================
# 1. TEST: List accounts (should be empty initially)
# =============================================================================
echo "📋 Listing all accounts..."
curl -s "$BASE_URL/api/accounts" \
  -H "x-api-key: $API_KEY" | json_pp
echo ""

# =============================================================================
# 2. CREATE: Add Gmail Account
# =============================================================================
# ⚠️  REPLACE THESE VALUES before running!
GMAIL_ADDRESS="your-email@gmail.com"
APP_PASSWORD="yourapppassword"  # 16 chars, no spaces
CLIENT_ID="my_company"

echo "➕ Creating Gmail account..."
curl -s -X POST "$BASE_URL/api/accounts" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"emailAddress\": \"$GMAIL_ADDRESS\",
    \"displayName\": \"My Gmail\",
    \"imapHost\": \"imap.gmail.com\",
    \"imapPort\": 993,
    \"smtpHost\": \"smtp.gmail.com\",
    \"smtpPort\": 587,
    \"username\": \"$GMAIL_ADDRESS\",
    \"password\": \"$APP_PASSWORD\",
    \"useTls\": true
  }" | json_pp
echo ""

# =============================================================================
# 3. SYNC: Fetch emails from all accounts
# =============================================================================
echo "🔄 Syncing emails..."
curl -s -X POST "$BASE_URL/api/sync" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | json_pp
echo ""

# =============================================================================
# 4. LIST: Get all messages
# =============================================================================
echo "📧 Listing messages..."
curl -s "$BASE_URL/api/messages" \
  -H "x-api-key: $API_KEY" | json_pp
echo ""

# =============================================================================
# 5. SEND: Send a test email (uncomment to use)
# =============================================================================
# ACCOUNT_ID="your-account-id-from-create-response"
# RECIPIENT="recipient@example.com"
#
# echo "📤 Sending test email..."
# curl -s -X POST "$BASE_URL/api/messages/send" \
#   -H "x-api-key: $API_KEY" \
#   -H "Content-Type: application/json" \
#   -d "{
#     \"accountId\": \"$ACCOUNT_ID\",
#     \"to\": [{\"address\": \"$RECIPIENT\"}],
#     \"subject\": \"Test from Email Service\",
#     \"bodyText\": \"This is a test email sent from my email service!\",
#     \"bodyHtml\": \"<h1>Hello!</h1><p>This is a test email.</p>\"
#   }" | json_pp

