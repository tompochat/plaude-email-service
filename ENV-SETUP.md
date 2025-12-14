# Environment Setup

Create a `.env.local` file in the project root with the following variables:

```env
# ============================================================================
# Email Service Environment Variables
# ============================================================================

# API Security
# Generate a secure random string (min 32 characters)
SERVICE_API_KEY=your-secure-api-key-at-least-32-characters

# Encryption key for storing credentials (exactly 32 characters)
# Generate with: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
ENCRYPTION_KEY=your-32-character-encryption-key

# UI API Key (same as SERVICE_API_KEY, but exposed to browser)
# This allows the UI to make authenticated API calls
NEXT_PUBLIC_API_KEY=your-secure-api-key-at-least-32-characters

# Optional: Custom data directory (defaults to ./data)
# DATA_DIR=./data

# Optional: Cron secret for scheduled sync (Vercel Cron, etc.)
# CRON_SECRET=your-cron-secret
```

## Generating Secure Keys

### Service API Key
```bash
# Generate a random 32+ character API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Encryption Key (must be exactly 32 characters)
```bash
# Generate a 32-character encryption key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## Phase 2: OAuth Providers (Optional)

For Gmail and Microsoft integration, add these variables:

```env
# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback

# Microsoft OAuth (Outlook/Office365)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/oauth/microsoft/callback
MICROSOFT_TENANT_ID=common

# Base URL for OAuth redirects
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

