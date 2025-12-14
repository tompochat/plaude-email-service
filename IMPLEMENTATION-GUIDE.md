# Email Service Implementation Guide

A multi-tenant email service built with Next.js that allows clients to connect their IMAP/SMTP accounts, receive emails, and send replies.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Phase 1: MVP Implementation](#3-phase-1-mvp-implementation)
4. [Phase 2: Enhanced Features](#4-phase-2-enhanced-features)
5. [API Reference](#5-api-reference)
6. [Testing Guide](#6-testing-guide)

---

## 1. Overview

### What We're Building

A standalone Next.js service that:
- Allows **multiple clients** (multi-tenant) to connect their email accounts via IMAP/SMTP
- **Fetches incoming emails** on manual trigger (Phase 1) or polling (Phase 2)
- **Stores attachments** on the local file system
- **Normalizes emails** into a unified format with basic threading
- Exposes a **REST API** for external applications to consume
- **Sends replies** through SMTP with proper threading headers

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Start Simple** | IMAP/SMTP only, JSON storage, manual sync |
| **Multi-Tenant** | Each client has isolated accounts via `clientId` |
| **Provider Agnostic** | Abstract providers behind interfaces for easy extension |
| **Repository Pattern** | Storage layer abstraction for future DB migration |
| **Strategy Pattern** | Email providers as interchangeable strategies |

### Tech Stack (Phase 1)

- **Framework**: Next.js 14+ (App Router)
- **Email**: `imapflow` (IMAP), `nodemailer` (SMTP), `mailparser` (parsing)
- **Storage**: JSON files (accounts, messages, sync state)
- **Attachments**: Local file system
- **Validation**: `zod`
- **IDs**: `uuid`

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL APPLICATIONS                                │
│           (Your AI Agent, Admin Dashboard, Other Services)                   │
│                                                                              │
│    Client A (clientId: "client_a")    Client B (clientId: "client_b")       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API (x-api-key auth)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EMAIL SERVICE (Next.js)                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                            API Layer                                   │  │
│  │  POST /api/accounts          - Create IMAP account for a client       │  │
│  │  GET  /api/accounts          - List accounts (filterable by clientId) │  │
│  │  POST /api/sync              - Fetch new emails (manual trigger)      │  │
│  │  GET  /api/messages          - List messages (filterable)             │  │
│  │  GET  /api/messages/:id      - Get message with attachments           │  │
│  │  POST /api/messages/send     - Send email/reply                       │  │
│  │  GET  /api/attachments/:id   - Download attachment                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          Service Layer                                 │  │
│  │  AccountService   - CRUD for connected accounts                        │  │
│  │  MessageService   - Email fetch, send, normalize                       │  │
│  │  SyncService      - Orchestrates sync per account                      │  │
│  │  AttachmentService - Store/retrieve attachments                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Provider Layer                                 │  │
│  │  ┌─────────────┐   (Phase 2)   ┌─────────────┐   ┌─────────────┐      │  │
│  │  │    IMAP     │               │   Gmail     │   │  Microsoft  │      │  │
│  │  │  Provider   │               │  Provider   │   │   Provider  │      │  │
│  │  └─────────────┘               └─────────────┘   └─────────────┘      │  │
│  │         │                            │                 │               │  │
│  │         └────────────────────────────┴─────────────────┘               │  │
│  │                                 │                                       │  │
│  │                    EmailProvider Interface                              │  │
│  │                    - fetchMessages()                                    │  │
│  │                    - sendMessage()                                      │  │
│  │                    - testConnection()                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Storage Layer                                  │  │
│  │  StorageAdapter Interface                                              │  │
│  │    ├── JsonStorage (Phase 1)                                           │  │
│  │    └── PostgresStorage (Phase 2)                                       │  │
│  │                                                                         │  │
│  │  Files:                                                                 │  │
│  │    /data/accounts.json                                                  │  │
│  │    /data/messages.json                                                  │  │
│  │    /data/sync-state.json                                                │  │
│  │    /data/attachments/{accountId}/{messageId}/{filename}                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ┌─────────────┐                 ┌─────────────┐
            │  Client A   │                 │  Client B   │
            │ IMAP Server │                 │ IMAP Server │
            │ SMTP Server │                 │ SMTP Server │
            └─────────────┘                 └─────────────┘
```

### 2.2 Data Flow: Receiving Emails

```
1. External App calls POST /api/sync { accountId: "..." } (or all accounts)
         │
         ▼
2. SyncService.syncAccount(accountId)
         │
         ├── Load account credentials (decrypt)
         │
         ▼
3. ImapProvider.fetchMessages(account, options)
         │
         ├── Connect to IMAP server
         ├── Search for unseen messages since last sync
         ├── For each message:
         │     ├── Parse with mailparser
         │     ├── Extract attachments → save to filesystem
         │     └── Normalize to UnifiedMessage format
         │
         ▼
4. Save messages to messages.json (deduplicated)
         │
         ▼
5. Update sync-state.json (lastUid, lastSyncAt)
         │
         ▼
6. Return { success: true, newMessages: 5 }
```

### 2.3 Data Flow: Sending Email/Reply

```
1. External App calls POST /api/messages/send
         │
         ├── accountId: "acc_123"
         ├── to: [{ address: "user@example.com" }]
         ├── subject: "Re: Your inquiry"
         ├── bodyHtml: "<p>Hello...</p>"
         ├── inReplyTo: "msg_456" (optional - for threading)
         ├── attachments: [{ filename, content (base64) }] (optional)
         │
         ▼
2. MessageService.sendMessage(request)
         │
         ├── Load account credentials
         ├── If inReplyTo provided:
         │     ├── Load original message
         │     └── Build References chain for threading
         │
         ▼
3. ImapProvider.sendMessage(account, options)
         │
         ├── Create nodemailer transport
         ├── Build email with proper headers:
         │     ├── In-Reply-To: <original-message-id>
         │     └── References: <chain of message ids>
         ├── Attach files if provided
         ├── Send via SMTP
         │
         ▼
4. Save sent message to messages.json (isOutgoing: true)
         │
         ▼
5. Return { success: true, messageId: "..." }
```

### 2.4 Directory Structure

```
email-service/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── accounts/
│   │   │   │   ├── route.ts                    # GET (list), POST (create)
│   │   │   │   └── [accountId]/
│   │   │   │       └── route.ts                # GET, PUT, DELETE specific
│   │   │   ├── messages/
│   │   │   │   ├── route.ts                    # GET (list messages)
│   │   │   │   ├── send/
│   │   │   │   │   └── route.ts                # POST (send message)
│   │   │   │   └── [messageId]/
│   │   │   │       └── route.ts                # GET specific message
│   │   │   ├── attachments/
│   │   │   │   └── [attachmentId]/
│   │   │   │       └── route.ts                # GET (download attachment)
│   │   │   └── sync/
│   │   │       └── route.ts                    # POST (trigger sync)
│   │   └── page.tsx                            # Health check / status page
│   │
│   ├── lib/
│   │   ├── providers/
│   │   │   ├── index.ts                        # Provider factory
│   │   │   ├── types.ts                        # EmailProvider interface
│   │   │   └── imap.provider.ts                # IMAP/SMTP implementation
│   │   │
│   │   ├── services/
│   │   │   ├── account.service.ts              # Account CRUD
│   │   │   ├── message.service.ts              # Message operations
│   │   │   ├── sync.service.ts                 # Sync orchestration
│   │   │   └── attachment.service.ts           # Attachment handling
│   │   │
│   │   ├── storage/
│   │   │   ├── index.ts                        # Storage factory
│   │   │   ├── types.ts                        # StorageAdapter interface
│   │   │   └── json.storage.ts                 # JSON file implementation
│   │   │
│   │   ├── utils/
│   │   │   ├── crypto.ts                       # Encryption for credentials
│   │   │   └── validation.ts                   # Zod schemas
│   │   │
│   │   └── middleware/
│   │       └── auth.ts                         # API key validation
│   │
│   └── types/
│       └── index.ts                            # Shared TypeScript types
│
├── data/                                       # JSON storage (gitignored)
│   ├── accounts.json
│   ├── messages.json
│   ├── sync-state.json
│   └── attachments/
│       └── {accountId}/
│           └── {messageId}/
│               └── {filename}
│
├── .env.local
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## 3. Phase 1: MVP Implementation

### Step 1: Project Setup

```bash
# Create Next.js project
npx create-next-app@latest email-service --typescript --eslint --app --src-dir --no-tailwind

cd email-service

# Install dependencies
npm install imapflow nodemailer mailparser uuid zod
npm install -D @types/nodemailer @types/mailparser @types/uuid
```

### Step 2: Environment Configuration

Create `.env.local`:

```env
# API Security
SERVICE_API_KEY=your-secure-api-key-min-32-chars

# Encryption for stored credentials (exactly 32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key

# Data directory (optional, defaults to ./data)
DATA_DIR=./data
```

### Step 3: Create Core Types

Create `src/types/index.ts` - see implementation file.

### Step 4: Implement Storage Layer

1. Create `src/lib/storage/types.ts` - Storage interface
2. Create `src/lib/storage/json.storage.ts` - JSON implementation
3. Create `src/lib/storage/index.ts` - Factory

### Step 5: Implement Utilities

1. Create `src/lib/utils/crypto.ts` - Credential encryption
2. Create `src/lib/utils/validation.ts` - Zod schemas
3. Create `src/lib/middleware/auth.ts` - API key validation

### Step 6: Implement Provider Layer

1. Create `src/lib/providers/types.ts` - Provider interface
2. Create `src/lib/providers/imap.provider.ts` - IMAP/SMTP implementation
3. Create `src/lib/providers/index.ts` - Factory

### Step 7: Implement Services

1. Create `src/lib/services/attachment.service.ts`
2. Create `src/lib/services/account.service.ts`
3. Create `src/lib/services/sync.service.ts`
4. Create `src/lib/services/message.service.ts`

### Step 8: Implement API Routes

1. `src/app/api/accounts/route.ts` - List/Create accounts
2. `src/app/api/accounts/[accountId]/route.ts` - Get/Delete account
3. `src/app/api/sync/route.ts` - Trigger email sync
4. `src/app/api/messages/route.ts` - List messages
5. `src/app/api/messages/[messageId]/route.ts` - Get message
6. `src/app/api/messages/send/route.ts` - Send email
7. `src/app/api/attachments/[attachmentId]/route.ts` - Download attachment

### Step 9: Add .gitignore entries

```gitignore
# Data directory
/data/

# Environment
.env.local
.env*.local
```

---

## 4. Phase 2: Enhanced Features

### 4.1 Database Migration (PostgreSQL)

**When to migrate**: When JSON files become slow (>1000 messages) or you need concurrent access.

1. Install Prisma: `npm install prisma @prisma/client`
2. Create `prisma/schema.prisma` with tables for accounts, messages, attachments
3. Create `src/lib/storage/postgres.storage.ts` implementing `StorageAdapter`
4. Update factory to use environment variable to switch storages

### 4.2 Polling System

**When to add**: When you need automatic email fetching without manual triggers.

Option A: **Vercel Cron** (if deploying to Vercel)
```json
// vercel.json
{
  "crons": [{
    "path": "/api/sync",
    "schedule": "*/5 * * * *"
  }]
}
```

Option B: **BullMQ** (self-hosted)
1. Install: `npm install bullmq ioredis`
2. Create worker that runs sync for each account at intervals

### 4.3 OAuth Providers (Gmail, Microsoft)

**When to add**: When clients need Gmail or Outlook/Office365 support.

1. Create `src/lib/providers/gmail.provider.ts`
2. Create `src/lib/providers/microsoft.provider.ts`
3. Add OAuth callback routes
4. Update provider factory

### 4.4 Cloud Attachment Storage (S3/R2)

**When to add**: When local filesystem isn't sufficient or for serverless deployments.

1. Install AWS SDK or use Cloudflare R2
2. Create `src/lib/services/cloud-attachment.service.ts`
3. Update attachment service to use cloud storage

### 4.5 Webhook Notifications

**When to add**: When external apps need real-time notifications of new emails.

1. Add webhook URL to account configuration
2. After sync, POST to webhook with new message IDs
3. Implement retry logic for failed webhooks

### 4.6 Advanced Threading (Cases/Conversations)

**When to add**: When you need to group related messages beyond basic In-Reply-To threading.

1. Add `Case` entity to track conversations
2. Implement case assignment logic (by thread, by sender, etc.)
3. Add case-related API endpoints

---

## 5. API Reference

### Authentication

All endpoints require the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" http://localhost:3000/api/accounts
```

### Endpoints

#### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List all accounts (filter: `?clientId=xxx`) |
| POST | `/api/accounts` | Create IMAP account |
| GET | `/api/accounts/:id` | Get account details |
| DELETE | `/api/accounts/:id` | Delete account |

**Create Account Request:**
```json
{
  "clientId": "client_a",
  "emailAddress": "support@company.com",
  "displayName": "Company Support",
  "imapHost": "imap.gmail.com",
  "imapPort": 993,
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "username": "support@company.com",
  "password": "app-specific-password",
  "useTls": true
}
```

#### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages` | List messages (filters: `accountId`, `clientId`, `since`, `threadId`, `isRead`, `limit`, `offset`) |
| GET | `/api/messages/:id` | Get message with attachment metadata |
| POST | `/api/messages/send` | Send new email or reply |

**Send Message Request:**
```json
{
  "accountId": "acc_123",
  "to": [{ "address": "user@example.com", "name": "John Doe" }],
  "cc": [],
  "subject": "Re: Your inquiry",
  "bodyText": "Plain text version",
  "bodyHtml": "<p>HTML version</p>",
  "inReplyTo": "msg_456",
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "base64-encoded-content",
      "contentType": "application/pdf"
    }
  ]
}
```

#### Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync` | Trigger sync for one or all accounts |

**Sync Request:**
```json
{
  "accountId": "acc_123"
}
```
*Omit `accountId` to sync all accounts.*

#### Attachments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attachments/:id` | Download attachment file |

---

## 6. Testing Guide

### Manual Testing Checklist

#### Setup
- [ ] Create `.env.local` with API key and encryption key
- [ ] Start dev server: `npm run dev`

#### Account Management
- [ ] Create account for Client A
- [ ] Create account for Client B  
- [ ] List all accounts
- [ ] List accounts filtered by clientId
- [ ] Get single account (verify password not exposed)
- [ ] Delete account

#### Email Sync
- [ ] Sync specific account
- [ ] Sync all accounts
- [ ] Verify messages stored in JSON
- [ ] Verify attachments saved to filesystem
- [ ] Verify deduplication (sync twice, no duplicates)

#### Messages
- [ ] List all messages
- [ ] Filter by accountId
- [ ] Filter by clientId
- [ ] Get single message with attachments
- [ ] Download attachment

#### Sending
- [ ] Send new email
- [ ] Send reply (verify threading headers)
- [ ] Send with attachments
- [ ] Verify sent message stored with isOutgoing=true

### Example cURL Commands

```bash
# Set API key
API_KEY="your-api-key"
BASE_URL="http://localhost:3000"

# Create account
curl -X POST "$BASE_URL/api/accounts" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client_a",
    "emailAddress": "test@example.com",
    "imapHost": "imap.example.com",
    "imapPort": 993,
    "smtpHost": "smtp.example.com",
    "smtpPort": 587,
    "username": "test@example.com",
    "password": "your-password",
    "useTls": true
  }'

# List accounts
curl "$BASE_URL/api/accounts" -H "x-api-key: $API_KEY"

# List accounts for specific client
curl "$BASE_URL/api/accounts?clientId=client_a" -H "x-api-key: $API_KEY"

# Sync all accounts
curl -X POST "$BASE_URL/api/sync" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Sync specific account
curl -X POST "$BASE_URL/api/sync" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"accountId": "your-account-id"}'

# List messages
curl "$BASE_URL/api/messages" -H "x-api-key: $API_KEY"

# Send reply
curl -X POST "$BASE_URL/api/messages/send" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "your-account-id",
    "to": [{"address": "recipient@example.com"}],
    "subject": "Re: Test",
    "bodyText": "This is a reply",
    "inReplyTo": "original-message-id"
  }'
```

---

## Next Steps

After completing Phase 1:
1. Test thoroughly with real email accounts
2. Evaluate which Phase 2 features you need
3. Consider database migration if JSON becomes slow
4. Add OAuth providers if needed

Ready to start? The implementation files follow this guide.

