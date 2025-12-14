# Mail Service - Current State Documentation

> **Last Updated:** December 14, 2025  
> **Version:** Phase 1 (IMAP/SMTP with JSON Storage)

This document provides a complete overview of everything the mail-service can do right now, how it works internally, and an assessment of database migration readiness.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Endpoints](#api-endpoints)
3. [Services Layer](#services-layer)
4. [Storage Layer](#storage-layer)
5. [Email Provider Layer](#email-provider-layer)
6. [Data Models](#data-models)
7. [Security & Authentication](#security--authentication)
8. [Database Migration Readiness](#database-migration-readiness)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js Routes)                   │
│  /api/accounts  /api/messages  /api/sync  /api/attachments          │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Services Layer                               │
│  AccountService  MessageService  SyncService  AttachmentService     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
┌─────────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│   Storage Layer     │ │   Providers   │ │ Attachment Storage  │
│   (JSON Files)      │ │   (IMAP/SMTP) │ │   (Filesystem)      │
│                     │ │               │ │                     │
│ - accounts.json     │ │ - ImapFlow    │ │ data/attachments/   │
│ - messages.json     │ │ - Nodemailer  │ │   └── {accountId}/  │
│ - sync-state.json   │ │               │ │       └── {msgId}/  │
└─────────────────────┘ └───────────────┘ └─────────────────────┘
```

### Directory Structure

```
src/
├── app/
│   └── api/                    # Next.js API Routes
│       ├── accounts/
│       │   ├── route.ts        # GET (list), POST (create)
│       │   └── [accountId]/
│       │       └── route.ts    # GET (single), DELETE
│       ├── messages/
│       │   ├── route.ts        # GET (list with filters)
│       │   ├── send/
│       │   │   └── route.ts    # POST (send email)
│       │   └── [messageId]/
│       │       └── route.ts    # GET, PATCH, DELETE
│       ├── attachments/
│       │   └── [attachmentId]/
│       │       └── route.ts    # GET (download)
│       └── sync/
│           └── route.ts        # POST (trigger), GET (cron)
├── lib/
│   ├── middleware/
│   │   └── auth.ts             # API key validation
│   ├── providers/
│   │   ├── types.ts            # EmailProvider interface
│   │   ├── index.ts            # Provider factory
│   │   └── imap.provider.ts    # IMAP/SMTP implementation
│   ├── services/
│   │   ├── account.service.ts  # Account CRUD + encryption
│   │   ├── message.service.ts  # Message management + sending
│   │   ├── sync.service.ts     # Email synchronization
│   │   └── attachment.service.ts # File storage
│   ├── storage/
│   │   ├── types.ts            # StorageAdapter interface
│   │   ├── index.ts            # Storage factory
│   │   └── json.storage.ts     # JSON file implementation
│   └── utils/
│       ├── crypto.ts           # AES-256-GCM encryption
│       └── validation.ts       # Zod schemas
├── types/
│   └── index.ts                # TypeScript type definitions
data/
├── accounts.json               # Stored accounts (encrypted passwords)
├── messages.json               # Stored emails
├── sync-state.json             # Sync tracking per account
└── attachments/                # Attachment files
    └── {accountId}/
        └── {messageId}/
            └── {uuid}_{filename}
```

---

## API Endpoints

### Authentication

All endpoints require the `x-api-key` header with the value from `SERVICE_API_KEY` environment variable.

```bash
curl -H "x-api-key: your-secret-key" http://localhost:3000/api/...
```

---

### 1. Accounts API

#### `GET /api/accounts`

**Purpose:** List all connected email accounts

**Location:** `src/app/api/accounts/route.ts` → `accountService.listAccounts()`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `clientId` | string | Optional. Filter accounts by client ID |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "clientId": "client-123",
      "provider": "imap",
      "emailAddress": "user@example.com",
      "displayName": "John Doe",
      "imapHost": "imap.example.com",
      "imapPort": 993,
      "smtpHost": "smtp.example.com",
      "smtpPort": 587,
      "status": "active",
      "lastSyncAt": "2025-12-14T10:00:00Z",
      "createdAt": "2025-12-01T10:00:00Z",
      "updatedAt": "2025-12-14T10:00:00Z"
    }
  ]
}
```

**Note:** Sensitive fields (`password`, `accessToken`, `refreshToken`) are automatically stripped from responses.

---

#### `POST /api/accounts`

**Purpose:** Connect a new IMAP email account

**Location:** `src/app/api/accounts/route.ts` → `accountService.createAccount()`

**Request Body:**
```json
{
  "clientId": "client-123",
  "emailAddress": "user@example.com",
  "displayName": "John Doe",
  "imapHost": "imap.example.com",
  "imapPort": 993,
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "username": "user@example.com",
  "password": "app-password",
  "useTls": true
}
```

**How It Works:**
1. Validates input with Zod schema (`createAccountSchema`)
2. Checks for duplicate email addresses per client
3. Tests IMAP connection with provided credentials
4. Encrypts password using AES-256-GCM
5. Saves to `data/accounts.json`

**Validation:** `src/lib/utils/validation.ts` - `createAccountSchema`

---

#### `GET /api/accounts/:accountId`

**Purpose:** Get details of a specific account

**Location:** `src/app/api/accounts/[accountId]/route.ts` → `accountService.getAccountForResponse()`

---

#### `DELETE /api/accounts/:accountId`

**Purpose:** Delete an email account

**Location:** `src/app/api/accounts/[accountId]/route.ts` → `accountService.deleteAccount()`

**Note:** Messages and attachments are NOT automatically deleted (by design, to preserve history).

---

### 2. Messages API

#### `GET /api/messages`

**Purpose:** List emails with filtering and pagination

**Location:** `src/app/api/messages/route.ts` → `messageService.getMessages()`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `accountId` | string | Filter by account |
| `clientId` | string | Filter by client |
| `since` | ISO date | Messages after this date |
| `until` | ISO date | Messages before this date |
| `threadId` | string | Filter by thread |
| `isRead` | boolean | Filter by read status |
| `isOutgoing` | boolean | Filter by direction |
| `hasAttachments` | boolean | Filter by attachments |
| `limit` | number | Max results (default: 50, max: 100) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [...],
    "pagination": {
      "total": 150,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

**How It Works:**
1. Parses and validates query params with Zod
2. Reads all messages from `data/messages.json`
3. Applies filters in memory
4. Sorts by date descending (newest first)
5. Applies pagination

---

#### `GET /api/messages/:messageId`

**Purpose:** Get a single message with full content

**Location:** `src/app/api/messages/[messageId]/route.ts` → `messageService.getMessage()`

---

#### `PATCH /api/messages/:messageId`

**Purpose:** Update message status (mark read, archive)

**Location:** `src/app/api/messages/[messageId]/route.ts`

**Request Body:**
```json
{
  "isRead": true,
  "status": "archived"  // 'new' | 'read' | 'replied' | 'archived'
}
```

**How It Works:**
1. Validates update with Zod schema
2. Calls appropriate method:
   - `isRead: true` → `messageService.markAsRead()`
   - `isRead: false` → `messageService.markAsUnread()`
   - `status: 'archived'` → `messageService.archiveMessage()`

---

#### `DELETE /api/messages/:messageId`

**Purpose:** Delete a message and its attachments

**Location:** `src/app/api/messages/[messageId]/route.ts` → `messageService.deleteMessage()`

**How It Works:**
1. Finds message in storage
2. If message has attachments, deletes attachment files from filesystem
3. Removes message record from `data/messages.json`

---

#### `POST /api/messages/send`

**Purpose:** Send a new email or reply to an existing one

**Location:** `src/app/api/messages/send/route.ts` → `messageService.sendMessage()`

**Request Body:**
```json
{
  "accountId": "account-uuid",
  "to": [{ "address": "recipient@example.com", "name": "Recipient" }],
  "cc": [{ "address": "cc@example.com" }],
  "bcc": [{ "address": "bcc@example.com" }],
  "subject": "Hello!",
  "bodyText": "Plain text content",
  "bodyHtml": "<p>HTML content</p>",
  "inReplyTo": "original-message-uuid",
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "base64-encoded-content",
      "contentType": "application/pdf"
    }
  ]
}
```

**How It Works:**
1. Gets account with decrypted credentials
2. If `inReplyTo` is provided:
   - Fetches original message
   - Builds `In-Reply-To` and `References` headers for threading
   - Auto-prefixes subject with "Re:" if needed
3. Sends via SMTP using Nodemailer
4. Saves sent message to storage with `isOutgoing: true`
5. Updates original message status to "replied" if this was a reply

---

### 3. Attachments API

#### `GET /api/attachments/:attachmentId`

**Purpose:** Download an attachment file

**Location:** `src/app/api/attachments/[attachmentId]/route.ts`

**How It Works:**
1. Searches all messages in storage for attachment with matching ID
2. Gets attachment metadata (filename, mimeType, storagePath)
3. Reads file from `data/attachments/{accountId}/{messageId}/{filename}`
4. Returns binary response with appropriate `Content-Type` and `Content-Disposition` headers

---

### 4. Sync API

#### `POST /api/sync`

**Purpose:** Trigger email synchronization

**Location:** `src/app/api/sync/route.ts` → `syncService.syncAccount()` or `syncService.syncAll()`

**Request Body:**
```json
{
  "accountId": "account-uuid",   // Optional - sync specific account
  "maxMessages": 10              // Optional - max messages to fetch (default: 5, max: 100)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "accountId": "uuid",
        "success": true,
        "newMessages": 3
      }
    ],
    "summary": {
      "total": 1,
      "successful": 1,
      "failed": 0,
      "newMessages": 3
    }
  }
}
```

**How It Works:**
1. For each account to sync:
   - Gets account with decrypted credentials
   - Gets previous sync state (lastUid)
   - Connects to IMAP server via ImapFlow
   - Searches for UNSEEN emails since account creation date
   - Fetches up to `maxMessages` emails
   - Parses with mailparser
   - Filters out duplicates (by providerMessageId)
   - Saves new messages to storage
   - Updates sync state with new lastUid
   - Updates account's lastSyncAt

---

#### `GET /api/sync`

**Purpose:** Trigger sync via cron job (Vercel Cron compatible)

**Authentication:** Accepts either `x-api-key` header OR `Authorization: Bearer {CRON_SECRET}` header

---

## Services Layer

### AccountService (`src/lib/services/account.service.ts`)

| Method | Description |
|--------|-------------|
| `listAccounts(clientId?)` | Get all accounts, optionally filtered by client |
| `getAccount(id, includeSecrets?)` | Get account by ID, optionally with decrypted credentials |
| `getAccountWithCredentials(id)` | Get account with decrypted password (for providers) |
| `getAccountForResponse(id)` | Get account with sensitive fields removed |
| `createAccount(request)` | Create account: test connection, encrypt password, save |
| `updateAccount(id, updates)` | Update account, re-test if credentials changed |
| `updateAccountStatus(id, status, error?)` | Update account status (internal use) |
| `updateLastSync(id)` | Update lastSyncAt timestamp |
| `deleteAccount(id)` | Delete account from storage |
| `verifyOwnership(accountId, clientId)` | Check if account belongs to client |

---

### MessageService (`src/lib/services/message.service.ts`)

| Method | Description |
|--------|-------------|
| `getMessages(filters)` | Get messages with filters |
| `countMessages(filters)` | Count matching messages |
| `getMessage(id)` | Get single message by ID |
| `getMessageByProviderId(accountId, providerMessageId)` | Get by email Message-ID |
| `getThread(threadId)` | Get all messages in a thread |
| `sendMessage(request)` | Send email via SMTP |
| `markAsRead(id)` | Mark message as read |
| `markAsUnread(id)` | Mark message as unread |
| `archiveMessage(id)` | Archive message |
| `deleteMessage(id)` | Delete message and attachments |
| `getMessagesForContact(accountId, email, limit?)` | Get messages from/to a contact |

---

### SyncService (`src/lib/services/sync.service.ts`)

| Method | Description |
|--------|-------------|
| `syncAll()` | Sync all active accounts |
| `syncAccount(accountId, maxMessages?)` | Sync single account |
| `syncByClient(clientId)` | Sync all accounts for a client |
| `resetSyncState(accountId)` | Reset sync state for fresh sync |

---

### AttachmentService (`src/lib/services/attachment.service.ts`)

| Method | Description |
|--------|-------------|
| `saveAttachment(accountId, messageId, filename, content, contentType)` | Save attachment file |
| `getAttachment(storagePath)` | Read attachment by path |
| `deleteAttachment(storagePath)` | Delete single attachment |
| `deleteMessageAttachments(accountId, messageId)` | Delete all attachments for a message |
| `getAttachmentInfo(storagePath)` | Get file metadata (exists, size) |
| `saveAttachmentFromBase64(...)` | Save from base64 content |

---

## Storage Layer

### StorageAdapter Interface (`src/lib/storage/types.ts`)

The storage layer uses an **adapter pattern** that makes database migration straightforward.

```typescript
interface StorageAdapter {
  // Accounts
  getAccounts(clientId?: string): Promise<ConnectedAccount[]>
  getAccount(id: string): Promise<ConnectedAccount | null>
  getAccountsByClient(clientId: string): Promise<ConnectedAccount[]>
  saveAccount(account: ConnectedAccount): Promise<void>
  deleteAccount(id: string): Promise<void>

  // Messages
  getMessages(filters: MessageFilters): Promise<UnifiedMessage[]>
  getMessage(id: string): Promise<UnifiedMessage | null>
  getMessageByProviderId(accountId: string, providerMessageId: string): Promise<UnifiedMessage | null>
  saveMessage(message: UnifiedMessage): Promise<void>
  saveMessages(messages: UnifiedMessage[]): Promise<void>
  updateMessage(id: string, updates: Partial<UnifiedMessage>): Promise<void>
  deleteMessage(id: string): Promise<void>
  countMessages(filters: MessageFilters): Promise<number>

  // Sync State
  getSyncState(accountId: string): Promise<SyncState | null>
  saveSyncState(state: SyncState): Promise<void>

  // Attachments (metadata only)
  getAttachment(id: string): Promise<AttachmentInfo | null>
  getAttachmentsByMessage(messageId: string): Promise<AttachmentInfo[]>
}
```

### JsonStorage Implementation (`src/lib/storage/json.storage.ts`)

Current implementation stores data in JSON files:

| File | Contents |
|------|----------|
| `data/accounts.json` | Array of `ConnectedAccount` objects |
| `data/messages.json` | Array of `UnifiedMessage` objects |
| `data/sync-state.json` | Array of `SyncState` objects |

**Features:**
- Simple file-based storage with JSON serialization
- Write locking to prevent concurrent write issues
- In-memory filtering and sorting
- Auto-creates `data/` directory if missing

**Limitations:**
- All data loaded into memory for operations
- No indexing (linear scans for queries)
- Not suitable for large datasets (>10k messages)

---

## Email Provider Layer

### EmailProvider Interface (`src/lib/providers/types.ts`)

```typescript
interface EmailProvider {
  readonly type: string
  
  testConnection(account: ConnectedAccount): Promise<boolean>
  fetchMessages(account: ConnectedAccount, options: FetchOptions): Promise<FetchResult>
  sendMessage(account: ConnectedAccount, options: SendOptions): Promise<SendResult>
  getMessage?(account: ConnectedAccount, providerMessageId: string): Promise<UnifiedMessage | null>
  downloadAttachment?(account: ConnectedAccount, attachment: AttachmentInfo): Promise<Buffer>
  refreshToken?(account: ConnectedAccount): Promise<{ accessToken: string, expiresAt: Date }>
}
```

### ImapProvider (`src/lib/providers/imap.provider.ts`)

**Dependencies:**
- `imapflow` - IMAP client
- `nodemailer` - SMTP sending
- `mailparser` - Email parsing

**Key Methods:**

| Method | Description |
|--------|-------------|
| `testConnection(account)` | Connect and logout to verify credentials |
| `fetchMessages(account, options)` | Fetch unseen emails from INBOX |
| `sendMessage(account, options)` | Send email via SMTP |

**Fetch Behavior:**
- Connects to INBOX folder only
- Fetches UNSEEN messages
- Filters by account creation date (prevents fetching old emails)
- Supports incremental sync via UID tracking
- Parses full email source with mailparser
- Does NOT mark emails as read (to avoid IMAP timeouts)

---

## Data Models

### ConnectedAccount (`src/types/index.ts`)

```typescript
interface ConnectedAccount {
  id: string                    // UUID
  clientId: string              // Multi-tenant identifier
  provider: 'imap' | 'gmail' | 'microsoft'
  emailAddress: string
  displayName?: string
  
  // IMAP/SMTP (encrypted at rest)
  imapHost?: string
  imapPort?: number
  smtpHost?: string
  smtpPort?: number
  username?: string
  password?: string             // Encrypted with AES-256-GCM
  useTls?: boolean
  
  // OAuth (Phase 2)
  accessToken?: string          // Encrypted
  refreshToken?: string         // Encrypted
  tokenExpiresAt?: string
  
  // Status
  status: 'active' | 'error' | 'disconnected' | 'pending'
  lastError?: string
  lastSyncAt?: string
  
  createdAt: string
  updatedAt: string
}
```

### UnifiedMessage (`src/types/index.ts`)

```typescript
interface UnifiedMessage {
  id: string                    // Internal UUID
  accountId: string
  clientId: string              // Denormalized for queries
  providerMessageId: string     // Email Message-ID header
  
  // Threading
  threadId?: string
  inReplyTo?: string
  references?: string[]
  
  // Envelope
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  replyTo?: EmailAddress
  subject: string
  
  // Body
  bodyText?: string
  bodyHtml?: string
  
  // Metadata
  date: string                  // When email was sent
  receivedAt: string            // When we received it
  isRead: boolean
  isOutgoing: boolean           // true = sent, false = received
  status: 'new' | 'read' | 'replied' | 'archived'
  
  // Attachments
  hasAttachments: boolean
  attachments?: AttachmentInfo[]
  
  // Sync
  syncedAt: string
  providerUid?: string          // IMAP UID
}
```

### SyncState (`src/types/index.ts`)

```typescript
interface SyncState {
  accountId: string
  lastUid?: number              // Last IMAP UID processed
  lastSyncAt?: string
  historyId?: string            // Gmail (Phase 2)
  deltaLink?: string            // Microsoft (Phase 2)
}
```

---

## Security & Authentication

### API Authentication (`src/lib/middleware/auth.ts`)

| Function | Description |
|----------|-------------|
| `validateApiKey(request)` | Validates `x-api-key` header against `SERVICE_API_KEY` env var |
| `validateCronSecret(request)` | Validates `Authorization: Bearer {secret}` against `CRON_SECRET` |
| `validateApiKeyOrCron(request)` | Accepts either (for sync endpoint) |

### Encryption (`src/lib/utils/crypto.ts`)

- **Algorithm:** AES-256-GCM
- **Key:** 32-character string from `ENCRYPTION_KEY` env var
- **Format:** `{iv}:{authTag}:{ciphertext}` (all hex-encoded)
- **Encrypted Fields:** `password`, `accessToken`, `refreshToken`

---

## Database Migration Readiness

### Assessment: ✅ READY FOR MIGRATION

The project architecture is **well-prepared** for database migration to Supabase or any other database.

### Why It's Ready

#### 1. Adapter Pattern Already Implemented

The storage layer uses an interface (`StorageAdapter`) that abstracts all data operations:

```typescript
// src/lib/storage/types.ts
export interface StorageAdapter {
  getAccounts(clientId?: string): Promise<ConnectedAccount[]>
  getAccount(id: string): Promise<ConnectedAccount | null>
  // ... all other methods
}
```

The factory function (`getStorage()`) returns the implementation:

```typescript
// src/lib/storage/index.ts
export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    // Currently returns JsonStorage
    // Easy to switch based on env var
    storageInstance = new JsonStorage();
  }
  return storageInstance;
}
```

#### 2. Services Don't Know About Storage Implementation

All services use `getStorage()` and work with the interface:

```typescript
// In any service
import { getStorage } from '@/lib/storage';

class SomeService {
  private storage = getStorage();
  
  async doSomething() {
    // Just uses interface methods
    const account = await this.storage.getAccount(id);
  }
}
```

#### 3. Clear Data Models

All types are well-defined in `src/types/index.ts` and map directly to database tables.

### Migration Steps for Supabase

1. **Create Database Tables:**

```sql
-- accounts table
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'imap',
  email_address TEXT NOT NULL,
  display_name TEXT,
  imap_host TEXT,
  imap_port INTEGER,
  smtp_host TEXT,
  smtp_port INTEGER,
  username TEXT,
  password TEXT,  -- encrypted
  use_tls BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(client_id, email_address)
);

-- messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  client_id TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  thread_id TEXT,
  in_reply_to TEXT,
  references TEXT[],
  from_address JSONB NOT NULL,
  to_addresses JSONB NOT NULL,
  cc_addresses JSONB,
  reply_to JSONB,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  date TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_outgoing BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'new',
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB,
  synced_at TIMESTAMPTZ NOT NULL,
  provider_uid TEXT,
  
  UNIQUE(account_id, provider_message_id)
);

-- sync_state table
CREATE TABLE sync_state (
  account_id UUID PRIMARY KEY REFERENCES accounts(id),
  last_uid INTEGER,
  last_sync_at TIMESTAMPTZ,
  history_id TEXT,
  delta_link TEXT
);

-- indexes
CREATE INDEX idx_messages_account_id ON messages(account_id);
CREATE INDEX idx_messages_client_id ON messages(client_id);
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_date ON messages(date DESC);
CREATE INDEX idx_accounts_client_id ON accounts(client_id);
```

2. **Create SupabaseStorage Implementation:**

```typescript
// src/lib/storage/supabase.storage.ts
import { createClient } from '@supabase/supabase-js';
import { StorageAdapter } from './types';

export class SupabaseStorage implements StorageAdapter {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  async getAccounts(clientId?: string): Promise<ConnectedAccount[]> {
    let query = this.supabase.from('accounts').select('*');
    if (clientId) query = query.eq('client_id', clientId);
    const { data, error } = await query;
    if (error) throw error;
    return data.map(this.mapAccountFromDb);
  }
  
  // ... implement all other methods
}
```

3. **Update Storage Factory:**

```typescript
// src/lib/storage/index.ts
export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    const storageType = process.env.STORAGE_TYPE || 'json';
    
    switch (storageType) {
      case 'supabase':
        storageInstance = new SupabaseStorage();
        break;
      case 'json':
      default:
        storageInstance = new JsonStorage();
    }
  }
  return storageInstance;
}
```

4. **Update Environment Variables:**

```bash
STORAGE_TYPE=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### What Needs Additional Work

| Component | Current State | Migration Consideration |
|-----------|---------------|------------------------|
| Attachments | Filesystem storage | Consider Supabase Storage or S3/R2 |
| Search | Not implemented | Use Supabase full-text search or separate service |
| Real-time | Not implemented | Use Supabase Realtime subscriptions |
| Pagination | Offset-based | Works, but cursor-based is more efficient |

### Summary

The codebase follows good separation of concerns and the adapter pattern, making database migration straightforward. You would:

1. Create a new `SupabaseStorage` class implementing `StorageAdapter`
2. Switch the factory to use it based on environment variable
3. No changes needed to routes, services, or providers

The main effort is implementing the ~15 methods in the `StorageAdapter` interface using Supabase client calls instead of JSON file operations.
