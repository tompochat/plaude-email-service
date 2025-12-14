# Multi-Tenant Email Service - Implementation Guide

A lightweight Next.js service that allows clients to connect their own email accounts (Gmail, Outlook, IMAP) and enables an AI agent to receive and respond to messages on their behalf.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Project Setup](#3-project-setup)
4. [Phase 1: Core Infrastructure](#4-phase-1-core-infrastructure)
5. [Phase 2: OAuth Providers](#5-phase-2-oauth-providers)
6. [Phase 3: Email Operations](#6-phase-3-email-operations)
7. [Phase 4: API Layer](#7-phase-4-api-layer)
8. [Phase 5: Webhook Integration](#8-phase-5-webhook-integration)
9. [Configuration Management](#9-configuration-management)
10. [Security Considerations](#10-security-considerations)
11. [Testing Strategy](#11-testing-strategy)
12. [Scaling Roadmap](#12-scaling-roadmap)

---

## 1. Project Overview

### 1.1 What We're Building

A standalone Next.js service that:

- Allows multiple clients to connect their email accounts (Gmail, Outlook, generic IMAP)
- Polls or receives webhooks for incoming emails
- Normalizes emails into a unified format
- Exposes an API for external applications (like your AI agent) to consume
- Sends replies from the connected accounts

### 1.2 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Start Simple** | JSON file storage initially, migrate to database later |
| **Service-Oriented** | Exposes REST API for consumption by other apps |
| **Provider Agnostic** | Abstract email providers behind a common interface |
| **Minimal Infrastructure** | No message queues or external services initially |
| **Secure by Default** | Encrypt tokens, validate all inputs |

### 1.3 Out of Scope (For Now)

- Real-time push notifications (WebSocket/SSE)
- Attachment storage (S3, cloud storage)
- Rate limiting and throttling
- Multi-region deployment
- Admin UI

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL APPLICATIONS                           │
│                    (Your AI Agent, Admin Tools, etc.)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          EMAIL SERVICE (Next.js)                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         API Layer                                │   │
│  │  /api/accounts     - Manage connected accounts                   │   │
│  │  /api/messages     - Fetch/send messages                         │   │
│  │  /api/oauth        - OAuth callback handlers                     │   │
│  │  /api/webhooks     - Receive provider webhooks                   │   │
│  │  /api/sync         - Trigger manual sync                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Service Layer                               │   │
│  │  AccountService    - CRUD for connected accounts                 │   │
│  │  MessageService    - Email fetch, send, normalize                │   │
│  │  SyncService       - Orchestrates polling/sync                   │   │
│  │  TokenService      - OAuth token management & refresh            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Provider Layer                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   Gmail     │  │  Microsoft  │  │    IMAP     │              │   │
│  │  │  Provider   │  │  Provider   │  │   Provider  │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  │         │                │                │                      │   │
│  │         └────────────────┼────────────────┘                      │   │
│  │                          ▼                                       │   │
│  │              EmailProvider Interface                             │   │
│  │              - connect()                                         │   │
│  │              - fetchMessages()                                   │   │
│  │              - sendMessage()                                     │   │
│  │              - refreshToken()                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Storage Layer                                │   │
│  │  JSON Files (Initial) → SQLite/PostgreSQL (Later)                │   │
│  │  - /data/accounts.json                                           │   │
│  │  - /data/messages.json                                           │   │
│  │  - /data/sync-state.json                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   Gmail     │ │  Outlook    │ │    IMAP     │
            │   (OAuth)   │ │  (OAuth)    │ │ (Credentials)│
            └─────────────┘ └─────────────┘ └─────────────┘
```

### 2.2 Data Flow: Receiving Email

```
1. Cron Job / Manual Trigger
         │
         ▼
2. SyncService.syncAll()
         │
         ├── For each connected account:
         │         │
         │         ▼
         │   3. Provider.fetchMessages(since: lastSyncTime)
         │         │
         │         ▼
         │   4. Normalize to UnifiedMessage format
         │         │
         │         ▼
         │   5. Store in messages.json
         │         │
         │         ▼
         │   6. Update sync-state.json (lastMessageId, lastSyncTime)
         │
         ▼
7. Return summary (newMessages count per account)
```

### 2.3 Data Flow: Sending Email

```
1. External App calls POST /api/messages/send
         │
         ├── accountId: "acc_123"
         ├── to: "user@example.com"
         ├── subject: "Re: Your inquiry"
         ├── body: "Hello..."
         ├── inReplyTo: "msg_456" (optional)
         │
         ▼
2. MessageService.send()
         │
         ├── Load account config
         ├── Get appropriate provider
         │
         ▼
3. Provider.sendMessage()
         │
         ├── Gmail: Use Gmail API
         ├── Microsoft: Use Graph API
         ├── IMAP: Use SMTP via Nodemailer
         │
         ▼
4. Store sent message in messages.json
         │
         ▼
5. Return { success: true, messageId: "..." }
```

---

## 3. Project Setup

### 3.1 Initialize Project

```bash
# Create Next.js project
npx create-next-app@latest email-service --typescript --tailwind --eslint --app --src-dir

cd email-service

# Install dependencies
npm install googleapis @microsoft/microsoft-graph-client @azure/msal-node
npm install imapflow nodemailer mailparser
npm install uuid zod
npm install -D @types/nodemailer @types/mailparser
```

### 3.2 Environment Variables

Create `.env.local`:

```env
# Service Configuration
SERVICE_API_KEY=your-secret-api-key-for-external-apps
ENCRYPTION_KEY=32-character-encryption-key-here

# Google OAuth (Gmail)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback

# Microsoft OAuth (Outlook/Office 365)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/oauth/microsoft/callback
MICROSOFT_TENANT_ID=common

# Base URL (for OAuth redirects)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Cron Secret (for Vercel Cron or external cron services)
CRON_SECRET=your-cron-secret
```

### 3.3 Directory Structure

```
email-service/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── accounts/
│   │   │   │   ├── route.ts              # GET (list), POST (create IMAP)
│   │   │   │   └── [accountId]/
│   │   │   │       └── route.ts          # GET, DELETE specific account
│   │   │   ├── messages/
│   │   │   │   ├── route.ts              # GET (list messages)
│   │   │   │   ├── send/
│   │   │   │   │   └── route.ts          # POST (send message)
│   │   │   │   └── [messageId]/
│   │   │   │       └── route.ts          # GET specific message
│   │   │   ├── oauth/
│   │   │   │   ├── google/
│   │   │   │   │   ├── route.ts          # GET (initiate OAuth)
│   │   │   │   │   └── callback/
│   │   │   │   │       └── route.ts      # GET (OAuth callback)
│   │   │   │   └── microsoft/
│   │   │   │       ├── route.ts          # GET (initiate OAuth)
│   │   │   │       └── callback/
│   │   │   │           └── route.ts      # GET (OAuth callback)
│   │   │   ├── sync/
│   │   │   │   └── route.ts              # POST (trigger sync)
│   │   │   └── webhooks/
│   │   │       ├── google/
│   │   │       │   └── route.ts          # POST (Gmail push notifications)
│   │   │       └── microsoft/
│   │   │           └── route.ts          # POST (Graph webhooks)
│   │   └── page.tsx                      # Simple status/health page
│   │
│   ├── lib/
│   │   ├── providers/
│   │   │   ├── index.ts                  # Provider factory
│   │   │   ├── types.ts                  # EmailProvider interface
│   │   │   ├── gmail.provider.ts         # Gmail implementation
│   │   │   ├── microsoft.provider.ts     # Microsoft Graph implementation
│   │   │   └── imap.provider.ts          # Generic IMAP implementation
│   │   │
│   │   ├── services/
│   │   │   ├── account.service.ts        # Account CRUD operations
│   │   │   ├── message.service.ts        # Message operations
│   │   │   ├── sync.service.ts           # Sync orchestration
│   │   │   └── token.service.ts          # Token refresh logic
│   │   │
│   │   ├── storage/
│   │   │   ├── index.ts                  # Storage factory
│   │   │   ├── types.ts                  # Storage interface
│   │   │   └── json.storage.ts           # JSON file implementation
│   │   │
│   │   ├── utils/
│   │   │   ├── crypto.ts                 # Encryption/decryption
│   │   │   ├── email-parser.ts           # Email normalization
│   │   │   └── validation.ts             # Zod schemas
│   │   │
│   │   └── middleware/
│   │       └── auth.ts                   # API key validation
│   │
│   └── types/
│       └── index.ts                      # Shared TypeScript types
│
├── data/                                 # JSON storage (gitignored)
│   ├── accounts.json
│   ├── messages.json
│   └── sync-state.json
│
├── .env.local
├── .gitignore
├── vercel.json                           # Cron configuration
└── package.json
```

---

## 4. Phase 1: Core Infrastructure

### 4.1 TypeScript Types

**File: `src/types/index.ts`**

```typescript
// Provider types
export type EmailProviderType = 'gmail' | 'microsoft' | 'imap';

// Account status
export type AccountStatus = 'active' | 'error' | 'disconnected' | 'pending';

// Connected email account
export interface ConnectedAccount {
  id: string;
  clientId: string;                    // Your client's identifier
  provider: EmailProviderType;
  emailAddress: string;
  displayName?: string;
  
  // OAuth tokens (encrypted at rest)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;             // ISO date string
  
  // IMAP credentials (encrypted at rest)
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string;
  useTls?: boolean;
  
  // Status
  status: AccountStatus;
  lastError?: string;
  lastSyncAt?: string;                 // ISO date string
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Unified message format (normalized across all providers)
export interface UnifiedMessage {
  id: string;
  accountId: string;
  
  // Provider-specific ID for threading and deduplication
  providerMessageId: string;
  
  // Threading
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  
  // Envelope
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  
  subject: string;
  
  // Body
  bodyText?: string;
  bodyHtml?: string;
  
  // Metadata
  date: string;                        // ISO date string
  isRead: boolean;
  isOutgoing: boolean;
  hasAttachments: boolean;
  
  // Attachments (metadata only - actual files stored separately)
  attachments?: AttachmentInfo[];
  
  // Internal
  syncedAt: string;
  raw?: string;                        // Original raw email (optional)
}

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;                  // For inline images
}

// Sync state per account
export interface SyncState {
  accountId: string;
  lastMessageId?: string;
  lastSyncAt?: string;
  historyId?: string;                  // Gmail-specific
  deltaLink?: string;                  // Microsoft-specific
}

// API request/response types
export interface SendMessageRequest {
  accountId: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;                  // Message ID to reply to
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 4.2 Storage Layer

**File: `src/lib/storage/types.ts`**

```typescript
import { ConnectedAccount, UnifiedMessage, SyncState } from '@/types';

export interface StorageAdapter {
  // Accounts
  getAccounts(): Promise<ConnectedAccount[]>;
  getAccount(id: string): Promise<ConnectedAccount | null>;
  getAccountsByClient(clientId: string): Promise<ConnectedAccount[]>;
  saveAccount(account: ConnectedAccount): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  
  // Messages
  getMessages(filters: MessageFilters): Promise<UnifiedMessage[]>;
  getMessage(id: string): Promise<UnifiedMessage | null>;
  saveMessage(message: UnifiedMessage): Promise<void>;
  saveMessages(messages: UnifiedMessage[]): Promise<void>;
  
  // Sync State
  getSyncState(accountId: string): Promise<SyncState | null>;
  saveSyncState(state: SyncState): Promise<void>;
}

export interface MessageFilters {
  accountId?: string;
  clientId?: string;
  since?: string;                      // ISO date
  limit?: number;
  offset?: number;
  threadId?: string;
  isRead?: boolean;
}
```

**File: `src/lib/storage/json.storage.ts`**

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { StorageAdapter, MessageFilters } from './types';
import { ConnectedAccount, UnifiedMessage, SyncState } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const SYNC_STATE_FILE = path.join(DATA_DIR, 'sync-state.json');

// File locking mechanism to prevent concurrent writes
let writeLock = Promise.resolve();

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readJsonFile<T>(filepath: string, defaultValue: T): Promise<T> {
  await ensureDataDir();
  try {
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile<T>(filepath: string, data: T): Promise<void> {
  await ensureDataDir();
  writeLock = writeLock.then(async () => {
    await writeFile(filepath, JSON.stringify(data, null, 2));
  });
  await writeLock;
}

export class JsonStorage implements StorageAdapter {
  async getAccounts(): Promise<ConnectedAccount[]> {
    return readJsonFile<ConnectedAccount[]>(ACCOUNTS_FILE, []);
  }
  
  async getAccount(id: string): Promise<ConnectedAccount | null> {
    const accounts = await this.getAccounts();
    return accounts.find(a => a.id === id) || null;
  }
  
  async getAccountsByClient(clientId: string): Promise<ConnectedAccount[]> {
    const accounts = await this.getAccounts();
    return accounts.filter(a => a.clientId === clientId);
  }
  
  async saveAccount(account: ConnectedAccount): Promise<void> {
    const accounts = await this.getAccounts();
    const index = accounts.findIndex(a => a.id === account.id);
    
    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }
    
    await writeJsonFile(ACCOUNTS_FILE, accounts);
  }
  
  async deleteAccount(id: string): Promise<void> {
    const accounts = await this.getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    await writeJsonFile(ACCOUNTS_FILE, filtered);
  }
  
  async getMessages(filters: MessageFilters): Promise<UnifiedMessage[]> {
    let messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    
    if (filters.accountId) {
      messages = messages.filter(m => m.accountId === filters.accountId);
    }
    
    if (filters.threadId) {
      messages = messages.filter(m => m.threadId === filters.threadId);
    }
    
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      messages = messages.filter(m => new Date(m.date) >= sinceDate);
    }
    
    if (filters.isRead !== undefined) {
      messages = messages.filter(m => m.isRead === filters.isRead);
    }
    
    // Sort by date descending (newest first)
    messages.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    
    return messages.slice(offset, offset + limit);
  }
  
  async getMessage(id: string): Promise<UnifiedMessage | null> {
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    return messages.find(m => m.id === id) || null;
  }
  
  async saveMessage(message: UnifiedMessage): Promise<void> {
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    const index = messages.findIndex(m => m.id === message.id);
    
    if (index >= 0) {
      messages[index] = message;
    } else {
      messages.push(message);
    }
    
    await writeJsonFile(MESSAGES_FILE, messages);
  }
  
  async saveMessages(newMessages: UnifiedMessage[]): Promise<void> {
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    
    for (const newMsg of newMessages) {
      const index = messages.findIndex(m => m.id === newMsg.id);
      if (index >= 0) {
        messages[index] = newMsg;
      } else {
        messages.push(newMsg);
      }
    }
    
    await writeJsonFile(MESSAGES_FILE, messages);
  }
  
  async getSyncState(accountId: string): Promise<SyncState | null> {
    const states = await readJsonFile<SyncState[]>(SYNC_STATE_FILE, []);
    return states.find(s => s.accountId === accountId) || null;
  }
  
  async saveSyncState(state: SyncState): Promise<void> {
    const states = await readJsonFile<SyncState[]>(SYNC_STATE_FILE, []);
    const index = states.findIndex(s => s.accountId === state.accountId);
    
    if (index >= 0) {
      states[index] = state;
    } else {
      states.push(state);
    }
    
    await writeJsonFile(SYNC_STATE_FILE, states);
  }
}
```

**File: `src/lib/storage/index.ts`**

```typescript
import { StorageAdapter } from './types';
import { JsonStorage } from './json.storage';

let storage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!storage) {
    storage = new JsonStorage();
  }
  return storage;
}

export * from './types';
```

### 4.3 Encryption Utilities

**File: `src/lib/utils/crypto.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }
  return Buffer.from(key, 'utf-8');
}

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function encryptAccountSecrets(account: Record<string, unknown>): void {
  const sensitiveFields = ['accessToken', 'refreshToken', 'password'];
  
  for (const field of sensitiveFields) {
    if (account[field] && typeof account[field] === 'string') {
      account[field] = encrypt(account[field] as string);
    }
  }
}

export function decryptAccountSecrets(account: Record<string, unknown>): void {
  const sensitiveFields = ['accessToken', 'refreshToken', 'password'];
  
  for (const field of sensitiveFields) {
    if (account[field] && typeof account[field] === 'string') {
      try {
        account[field] = decrypt(account[field] as string);
      } catch {
        // Field might not be encrypted
      }
    }
  }
}
```

### 4.4 API Authentication Middleware

**File: `src/lib/middleware/auth.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';

export function validateApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SERVICE_API_KEY;
  
  if (!expectedKey) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Service misconfigured' },
      { status: 500 }
    );
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Invalid or missing API key' },
      { status: 401 }
    );
  }
  
  return null;
}

export function validateCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    return null;
  }
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null;
}
```

### 4.5 Validation Schemas

**File: `src/lib/utils/validation.ts`**

```typescript
import { z } from 'zod';

export const emailAddressSchema = z.object({
  address: z.string().email(),
  name: z.string().optional(),
});

export const createImapAccountSchema = z.object({
  clientId: z.string().min(1),
  emailAddress: z.string().email(),
  displayName: z.string().optional(),
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive(),
  username: z.string().min(1),
  password: z.string().min(1),
  useTls: z.boolean().default(true),
});

export const sendMessageSchema = z.object({
  accountId: z.string().min(1),
  to: z.array(emailAddressSchema).min(1),
  cc: z.array(emailAddressSchema).optional(),
  bcc: z.array(emailAddressSchema).optional(),
  subject: z.string(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  inReplyTo: z.string().optional(),
}).refine(
  data => data.bodyText || data.bodyHtml,
  { message: 'Either bodyText or bodyHtml must be provided' }
);

export const messageFiltersSchema = z.object({
  accountId: z.string().optional(),
  clientId: z.string().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  threadId: z.string().optional(),
  isRead: z.coerce.boolean().optional(),
});
```

---

## 5. Phase 2: OAuth Providers

### 5.1 Provider Interface

**File: `src/lib/providers/types.ts`**

```typescript
import { ConnectedAccount, UnifiedMessage, SyncState } from '@/types';

export interface FetchOptions {
  since?: Date;
  maxResults?: number;
  syncState?: SyncState;
}

export interface FetchResult {
  messages: UnifiedMessage[];
  newSyncState: Partial<SyncState>;
}

export interface SendOptions {
  to: { address: string; name?: string }[];
  cc?: { address: string; name?: string }[];
  bcc?: { address: string; name?: string }[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  readonly type: string;
  
  testConnection(account: ConnectedAccount): Promise<boolean>;
  
  fetchMessages(
    account: ConnectedAccount, 
    options: FetchOptions
  ): Promise<FetchResult>;
  
  sendMessage(
    account: ConnectedAccount, 
    options: SendOptions
  ): Promise<SendResult>;
  
  refreshToken?(account: ConnectedAccount): Promise<{
    accessToken: string;
    expiresAt: Date;
  }>;
}
```

### 5.2 Gmail Provider

**File: `src/lib/providers/gmail.provider.ts`**

```typescript
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { 
  EmailProvider, 
  FetchOptions, 
  FetchResult, 
  SendOptions, 
  SendResult 
} from './types';
import { ConnectedAccount, UnifiedMessage, EmailAddress } from '@/types';
import { v4 as uuid } from 'uuid';

export class GmailProvider implements EmailProvider {
  readonly type = 'gmail';
  
  private getOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }
  
  private getAuthenticatedClient(account: ConnectedAccount): OAuth2Client {
    const client = this.getOAuth2Client();
    client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });
    return client;
  }
  
  private getGmailClient(account: ConnectedAccount): gmail_v1.Gmail {
    const auth = this.getAuthenticatedClient(account);
    return google.gmail({ version: 'v1', auth });
  }
  
  getAuthUrl(state: string): string {
    const client = this.getOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });
  }
  
  async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    email: string;
  }> {
    const client = this.getOAuth2Client();
    const { tokens } = await client.getToken(code);
    
    client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    
    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: new Date(tokens.expiry_date!),
      email: userInfo.data.email!,
    };
  }
  
  async testConnection(account: ConnectedAccount): Promise<boolean> {
    try {
      const gmail = this.getGmailClient(account);
      await gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch {
      return false;
    }
  }
  
  async fetchMessages(
    account: ConnectedAccount, 
    options: FetchOptions
  ): Promise<FetchResult> {
    const gmail = this.getGmailClient(account);
    const messages: UnifiedMessage[] = [];
    
    if (options.syncState?.historyId) {
      return this.fetchWithHistory(account, gmail, options);
    }
    
    const query = options.since 
      ? `after:${Math.floor(options.since.getTime() / 1000)}` 
      : 'in:inbox';
    
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: options.maxResults || 50,
    });
    
    const messageIds = listResponse.data.messages || [];
    
    for (const { id } of messageIds) {
      if (!id) continue;
      
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      
      const unified = this.parseGmailMessage(msg.data, account.id);
      if (unified) {
        messages.push(unified);
      }
    }
    
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    return {
      messages,
      newSyncState: {
        historyId: profile.data.historyId || undefined,
        lastSyncAt: new Date().toISOString(),
      },
    };
  }
  
  private async fetchWithHistory(
    account: ConnectedAccount,
    gmail: gmail_v1.Gmail,
    options: FetchOptions
  ): Promise<FetchResult> {
    const messages: UnifiedMessage[] = [];
    
    try {
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: options.syncState!.historyId,
        historyTypes: ['messageAdded'],
      });
      
      const historyRecords = historyResponse.data.history || [];
      const newMessageIds = new Set<string>();
      
      for (const record of historyRecords) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) {
            newMessageIds.add(added.message.id);
          }
        }
      }
      
      for (const id of newMessageIds) {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        });
        
        const unified = this.parseGmailMessage(msg.data, account.id);
        if (unified) {
          messages.push(unified);
        }
      }
      
      return {
        messages,
        newSyncState: {
          historyId: historyResponse.data.historyId || options.syncState!.historyId,
          lastSyncAt: new Date().toISOString(),
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('historyId')) {
        return this.fetchMessages(account, { ...options, syncState: undefined });
      }
      throw error;
    }
  }
  
  async sendMessage(
    account: ConnectedAccount, 
    options: SendOptions
  ): Promise<SendResult> {
    try {
      const gmail = this.getGmailClient(account);
      
      const message = this.buildRawMessage(account.emailAddress, options);
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
      
      return {
        success: true,
        messageId: response.data.id || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async refreshToken(account: ConnectedAccount): Promise<{
    accessToken: string;
    expiresAt: Date;
  }> {
    const client = this.getOAuth2Client();
    client.setCredentials({ refresh_token: account.refreshToken });
    
    const { credentials } = await client.refreshAccessToken();
    
    return {
      accessToken: credentials.access_token!,
      expiresAt: new Date(credentials.expiry_date!),
    };
  }
  
  private parseGmailMessage(
    msg: gmail_v1.Schema$Message, 
    accountId: string
  ): UnifiedMessage | null {
    if (!msg.id || !msg.payload) return null;
    
    const headers = msg.payload.headers || [];
    const getHeader = (name: string) => 
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;
    
    const from = this.parseEmailAddress(getHeader('From') || '');
    const to = this.parseEmailAddresses(getHeader('To') || '');
    const cc = this.parseEmailAddresses(getHeader('Cc') || '');
    
    let bodyText = '';
    let bodyHtml = '';
    
    const extractBody = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };
    
    extractBody(msg.payload);
    
    return {
      id: uuid(),
      accountId,
      providerMessageId: msg.id,
      threadId: msg.threadId || undefined,
      inReplyTo: getHeader('In-Reply-To') || undefined,
      references: getHeader('References')?.split(/\s+/).filter(Boolean),
      from,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: getHeader('Subject') || '(No Subject)',
      bodyText: bodyText || undefined,
      bodyHtml: bodyHtml || undefined,
      date: new Date(parseInt(msg.internalDate || '0')).toISOString(),
      isRead: !msg.labelIds?.includes('UNREAD'),
      isOutgoing: msg.labelIds?.includes('SENT') || false,
      hasAttachments: this.checkForAttachments(msg.payload),
      syncedAt: new Date().toISOString(),
    };
  }
  
  private parseEmailAddress(str: string): EmailAddress {
    const match = str.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
    if (match) {
      return { name: match[1]?.trim(), address: match[2].trim() };
    }
    return { address: str.trim() };
  }
  
  private parseEmailAddresses(str: string): EmailAddress[] {
    if (!str) return [];
    return str.split(',').map(s => this.parseEmailAddress(s.trim()));
  }
  
  private checkForAttachments(part: gmail_v1.Schema$MessagePart): boolean {
    if (part.filename && part.filename.length > 0) return true;
    if (part.parts) {
      return part.parts.some(p => this.checkForAttachments(p));
    }
    return false;
  }
  
  private buildRawMessage(fromEmail: string, options: SendOptions): string {
    const lines: string[] = [];
    
    lines.push(`From: ${fromEmail}`);
    lines.push(`To: ${options.to.map(t => t.name ? `"${t.name}" <${t.address}>` : t.address).join(', ')}`);
    
    if (options.cc?.length) {
      lines.push(`Cc: ${options.cc.map(t => t.name ? `"${t.name}" <${t.address}>` : t.address).join(', ')}`);
    }
    
    lines.push(`Subject: ${options.subject}`);
    lines.push(`MIME-Version: 1.0`);
    
    if (options.inReplyTo) {
      lines.push(`In-Reply-To: ${options.inReplyTo}`);
    }
    
    if (options.references?.length) {
      lines.push(`References: ${options.references.join(' ')}`);
    }
    
    if (options.bodyHtml) {
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('');
      lines.push(options.bodyHtml);
    } else {
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('');
      lines.push(options.bodyText || '');
    }
    
    return lines.join('\r\n');
  }
}

export const gmailProvider = new GmailProvider();
```

### 5.3 IMAP Provider

**File: `src/lib/providers/imap.provider.ts`**

```typescript
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import nodemailer from 'nodemailer';
import { 
  EmailProvider, 
  FetchOptions, 
  FetchResult, 
  SendOptions, 
  SendResult 
} from './types';
import { ConnectedAccount, UnifiedMessage } from '@/types';
import { v4 as uuid } from 'uuid';

export class ImapProvider implements EmailProvider {
  readonly type = 'imap';
  
  private createImapClient(account: ConnectedAccount): ImapFlow {
    return new ImapFlow({
      host: account.imapHost!,
      port: account.imapPort!,
      secure: account.useTls ?? true,
      auth: {
        user: account.username!,
        pass: account.password!,
      },
      logger: false,
    });
  }
  
  private createSmtpTransport(account: ConnectedAccount) {
    return nodemailer.createTransport({
      host: account.smtpHost!,
      port: account.smtpPort!,
      secure: account.smtpPort === 465,
      auth: {
        user: account.username!,
        pass: account.password!,
      },
    });
  }
  
  async testConnection(account: ConnectedAccount): Promise<boolean> {
    const client = this.createImapClient(account);
    
    try {
      await client.connect();
      await client.logout();
      return true;
    } catch {
      return false;
    }
  }
  
  async fetchMessages(
    account: ConnectedAccount, 
    options: FetchOptions
  ): Promise<FetchResult> {
    const client = this.createImapClient(account);
    const messages: UnifiedMessage[] = [];
    
    try {
      await client.connect();
      
      const lock = await client.getMailboxLock('INBOX');
      
      try {
        const searchCriteria: Record<string, unknown> = { seen: false };
        
        if (options.since) {
          searchCriteria.since = options.since;
        }
        
        const fetchOptions = {
          source: true,
          uid: true,
          flags: true,
          envelope: true,
        };
        
        let count = 0;
        const maxResults = options.maxResults || 50;
        let lastUid: number | undefined;
        
        for await (const msg of client.fetch(searchCriteria, fetchOptions)) {
          if (count >= maxResults) break;
          
          const parsed = await simpleParser(msg.source);
          const unified = this.parseEmail(parsed, msg.uid.toString(), account.id);
          
          if (unified) {
            messages.push(unified);
            count++;
          }
          
          lastUid = msg.uid;
          
          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
        }
        
        return {
          messages,
          newSyncState: {
            lastMessageId: lastUid?.toString(),
            lastSyncAt: new Date().toISOString(),
          },
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }
  
  async sendMessage(
    account: ConnectedAccount, 
    options: SendOptions
  ): Promise<SendResult> {
    try {
      const transport = this.createSmtpTransport(account);
      
      const mailOptions = {
        from: account.displayName 
          ? `"${account.displayName}" <${account.emailAddress}>`
          : account.emailAddress,
        to: options.to.map(t => 
          t.name ? `"${t.name}" <${t.address}>` : t.address
        ).join(', '),
        cc: options.cc?.map(t => 
          t.name ? `"${t.name}" <${t.address}>` : t.address
        ).join(', '),
        subject: options.subject,
        text: options.bodyText,
        html: options.bodyHtml,
        inReplyTo: options.inReplyTo,
        references: options.references?.join(' '),
      };
      
      const result = await transport.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private parseEmail(
    parsed: ParsedMail, 
    uid: string, 
    accountId: string
  ): UnifiedMessage | null {
    if (!parsed.messageId) return null;
    
    return {
      id: uuid(),
      accountId,
      providerMessageId: parsed.messageId,
      inReplyTo: parsed.inReplyTo || undefined,
      references: Array.isArray(parsed.references) 
        ? parsed.references 
        : parsed.references?.split(/\s+/).filter(Boolean),
      from: {
        address: parsed.from?.value[0]?.address || 'unknown',
        name: parsed.from?.value[0]?.name,
      },
      to: (parsed.to?.value || []).map(t => ({
        address: t.address || 'unknown',
        name: t.name,
      })),
      cc: parsed.cc?.value.map(t => ({
        address: t.address || 'unknown',
        name: t.name,
      })),
      subject: parsed.subject || '(No Subject)',
      bodyText: parsed.text || undefined,
      bodyHtml: parsed.html || undefined,
      date: parsed.date?.toISOString() || new Date().toISOString(),
      isRead: false,
      isOutgoing: false,
      hasAttachments: (parsed.attachments?.length || 0) > 0,
      attachments: parsed.attachments?.map((a, i) => ({
        id: `${uid}_${i}`,
        filename: a.filename || `attachment_${i}`,
        mimeType: a.contentType,
        size: a.size,
        contentId: a.contentId,
      })),
      syncedAt: new Date().toISOString(),
    };
  }
}

export const imapProvider = new ImapProvider();
```

### 5.4 Provider Factory

**File: `src/lib/providers/index.ts`**

```typescript
import { EmailProvider } from './types';
import { gmailProvider } from './gmail.provider';
import { imapProvider } from './imap.provider';
import { EmailProviderType } from '@/types';

const providers: Record<string, EmailProvider> = {
  gmail: gmailProvider,
  imap: imapProvider,
};

export function getProvider(type: EmailProviderType): EmailProvider {
  const provider = providers[type];
  if (!provider) {
    throw new Error(`Unknown provider type: ${type}`);
  }
  return provider;
}

export * from './types';
export { gmailProvider, imapProvider };
```

---

## 6. Phase 3: Email Operations

### 6.1 Account Service

**File: `src/lib/services/account.service.ts`**

```typescript
import { v4 as uuid } from 'uuid';
import { getStorage } from '@/lib/storage';
import { getProvider } from '@/lib/providers';
import { encryptAccountSecrets, decryptAccountSecrets } from '@/lib/utils/crypto';
import { ConnectedAccount } from '@/types';

export class AccountService {
  private storage = getStorage();
  
  async listAccounts(clientId?: string): Promise<ConnectedAccount[]> {
    const accounts = clientId 
      ? await this.storage.getAccountsByClient(clientId)
      : await this.storage.getAccounts();
    
    return accounts.map(a => {
      const copy = { ...a };
      decryptAccountSecrets(copy);
      delete copy.accessToken;
      delete copy.refreshToken;
      delete copy.password;
      return copy;
    });
  }
  
  async getAccount(id: string): Promise<ConnectedAccount | null> {
    const account = await this.storage.getAccount(id);
    if (account) {
      decryptAccountSecrets(account);
    }
    return account;
  }
  
  async createOAuthAccount(
    clientId: string,
    provider: 'gmail' | 'microsoft',
    email: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<ConnectedAccount> {
    const account: ConnectedAccount = {
      id: uuid(),
      clientId,
      provider,
      emailAddress: email,
      accessToken,
      refreshToken,
      tokenExpiresAt: expiresAt.toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const providerInstance = getProvider(provider);
    const connected = await providerInstance.testConnection(account);
    
    if (!connected) {
      throw new Error('Failed to connect with provided credentials');
    }
    
    const toStore = { ...account };
    encryptAccountSecrets(toStore);
    await this.storage.saveAccount(toStore);
    
    return account;
  }
  
  async createImapAccount(
    clientId: string,
    config: {
      emailAddress: string;
      displayName?: string;
      imapHost: string;
      imapPort: number;
      smtpHost: string;
      smtpPort: number;
      username: string;
      password: string;
      useTls?: boolean;
    }
  ): Promise<ConnectedAccount> {
    const account: ConnectedAccount = {
      id: uuid(),
      clientId,
      provider: 'imap',
      emailAddress: config.emailAddress,
      displayName: config.displayName,
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      username: config.username,
      password: config.password,
      useTls: config.useTls ?? true,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const provider = getProvider('imap');
    const connected = await provider.testConnection(account);
    
    if (!connected) {
      throw new Error('Failed to connect with provided credentials');
    }
    
    const toStore = { ...account };
    encryptAccountSecrets(toStore);
    await this.storage.saveAccount(toStore);
    
    return account;
  }
  
  async updateAccountStatus(
    id: string, 
    status: ConnectedAccount['status'], 
    error?: string
  ): Promise<void> {
    const account = await this.storage.getAccount(id);
    if (!account) throw new Error('Account not found');
    
    account.status = status;
    account.lastError = error;
    account.updatedAt = new Date().toISOString();
    
    await this.storage.saveAccount(account);
  }
  
  async updateTokens(
    id: string,
    accessToken: string,
    expiresAt: Date
  ): Promise<void> {
    const account = await this.storage.getAccount(id);
    if (!account) throw new Error('Account not found');
    
    decryptAccountSecrets(account);
    
    account.accessToken = accessToken;
    account.tokenExpiresAt = expiresAt.toISOString();
    account.updatedAt = new Date().toISOString();
    
    encryptAccountSecrets(account);
    await this.storage.saveAccount(account);
  }
  
  async deleteAccount(id: string): Promise<void> {
    await this.storage.deleteAccount(id);
  }
}

export const accountService = new AccountService();
```

### 6.2 Sync Service

**File: `src/lib/services/sync.service.ts`**

```typescript
import { getStorage } from '@/lib/storage';
import { getProvider } from '@/lib/providers';
import { accountService } from './account.service';
import { tokenService } from './token.service';
import { UnifiedMessage } from '@/types';

export interface SyncResult {
  accountId: string;
  success: boolean;
  newMessages: number;
  error?: string;
}

export class SyncService {
  private storage = getStorage();
  
  async syncAll(): Promise<SyncResult[]> {
    const accounts = await this.storage.getAccounts();
    const results: SyncResult[] = [];
    
    for (const account of accounts) {
      if (account.status !== 'active') {
        results.push({
          accountId: account.id,
          success: false,
          newMessages: 0,
          error: `Account is ${account.status}`,
        });
        continue;
      }
      
      const result = await this.syncAccount(account.id);
      results.push(result);
    }
    
    return results;
  }
  
  async syncAccount(accountId: string): Promise<SyncResult> {
    try {
      let account = await accountService.getAccount(accountId);
      
      if (!account) {
        return {
          accountId,
          success: false,
          newMessages: 0,
          error: 'Account not found',
        };
      }
      
      if (account.provider !== 'imap') {
        account = await tokenService.ensureValidToken(account);
      }
      
      const provider = getProvider(account.provider);
      const syncState = await this.storage.getSyncState(accountId);
      
      const result = await provider.fetchMessages(account, {
        syncState: syncState || undefined,
        maxResults: 50,
      });
      
      const newMessages: UnifiedMessage[] = [];
      for (const msg of result.messages) {
        const existing = await this.findExistingMessage(accountId, msg.providerMessageId);
        if (!existing) {
          newMessages.push(msg);
        }
      }
      
      if (newMessages.length > 0) {
        await this.storage.saveMessages(newMessages);
      }
      
      await this.storage.saveSyncState({
        accountId,
        ...result.newSyncState,
      });
      
      await accountService.updateAccountStatus(accountId, 'active');
      
      return {
        accountId,
        success: true,
        newMessages: newMessages.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await accountService.updateAccountStatus(accountId, 'error', errorMessage);
      
      return {
        accountId,
        success: false,
        newMessages: 0,
        error: errorMessage,
      };
    }
  }
  
  private async findExistingMessage(
    accountId: string, 
    providerMessageId: string
  ): Promise<UnifiedMessage | null> {
    const messages = await this.storage.getMessages({ accountId, limit: 1000 });
    return messages.find(m => m.providerMessageId === providerMessageId) || null;
  }
}

export const syncService = new SyncService();
```

### 6.3 Token Service

**File: `src/lib/services/token.service.ts`**

```typescript
import { getProvider } from '@/lib/providers';
import { accountService } from './account.service';
import { ConnectedAccount } from '@/types';

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export class TokenService {
  async ensureValidToken(account: ConnectedAccount): Promise<ConnectedAccount> {
    if (account.provider === 'imap') {
      return account;
    }
    
    if (!account.tokenExpiresAt) {
      return account;
    }
    
    const expiresAt = new Date(account.tokenExpiresAt);
    const now = new Date();
    
    if (expiresAt.getTime() - now.getTime() > TOKEN_REFRESH_BUFFER_MS) {
      return account;
    }
    
    const provider = getProvider(account.provider);
    
    if (!provider.refreshToken) {
      throw new Error(`Provider ${account.provider} does not support token refresh`);
    }
    
    const { accessToken, expiresAt: newExpiresAt } = await provider.refreshToken(account);
    
    await accountService.updateTokens(account.id, accessToken, newExpiresAt);
    
    return {
      ...account,
      accessToken,
      tokenExpiresAt: newExpiresAt.toISOString(),
    };
  }
}

export const tokenService = new TokenService();
```

### 6.4 Message Service

**File: `src/lib/services/message.service.ts`**

```typescript
import { getStorage } from '@/lib/storage';
import { getProvider } from '@/lib/providers';
import { accountService } from './account.service';
import { UnifiedMessage, SendMessageRequest, ApiResponse } from '@/types';
import { MessageFilters } from '@/lib/storage/types';

export class MessageService {
  private storage = getStorage();
  
  async getMessages(filters: MessageFilters): Promise<UnifiedMessage[]> {
    return this.storage.getMessages(filters);
  }
  
  async getMessage(id: string): Promise<UnifiedMessage | null> {
    return this.storage.getMessage(id);
  }
  
  async sendMessage(request: SendMessageRequest): Promise<ApiResponse<{ messageId?: string }>> {
    const account = await accountService.getAccount(request.accountId);
    
    if (!account) {
      return { success: false, error: 'Account not found' };
    }
    
    if (account.status !== 'active') {
      return { success: false, error: `Account is ${account.status}` };
    }
    
    const provider = getProvider(account.provider);
    
    let inReplyToId: string | undefined;
    let references: string[] | undefined;
    
    if (request.inReplyTo) {
      const originalMessage = await this.storage.getMessage(request.inReplyTo);
      if (originalMessage) {
        inReplyToId = originalMessage.providerMessageId;
        references = originalMessage.references 
          ? [...originalMessage.references, originalMessage.providerMessageId]
          : [originalMessage.providerMessageId];
      }
    }
    
    const result = await provider.sendMessage(account, {
      to: request.to,
      cc: request.cc,
      bcc: request.bcc,
      subject: request.subject,
      bodyText: request.bodyText,
      bodyHtml: request.bodyHtml,
      inReplyTo: inReplyToId,
      references,
    });
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    return { success: true, data: { messageId: result.messageId } };
  }
}

export const messageService = new MessageService();
```

---

## 7. Phase 4: API Layer

### 7.1 Account Endpoints

**File: `src/app/api/accounts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { accountService } from '@/lib/services/account.service';
import { createImapAccountSchema } from '@/lib/utils/validation';
import { ApiResponse, ConnectedAccount } from '@/types';

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  const clientId = request.nextUrl.searchParams.get('clientId') || undefined;
  
  try {
    const accounts = await accountService.listAccounts(clientId);
    return NextResponse.json<ApiResponse<ConnectedAccount[]>>({
      success: true,
      data: accounts,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const body = await request.json();
    const validated = createImapAccountSchema.parse(body);
    
    const account = await accountService.createImapAccount(
      validated.clientId,
      validated
    );
    
    const { password, ...safeAccount } = account;
    
    return NextResponse.json<ApiResponse<Partial<ConnectedAccount>>>(
      { success: true, data: safeAccount },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 400 }
    );
  }
}
```

### 7.2 Message Endpoints

**File: `src/app/api/messages/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { messageService } from '@/lib/services/message.service';
import { messageFiltersSchema } from '@/lib/utils/validation';
import { ApiResponse, UnifiedMessage } from '@/types';

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = messageFiltersSchema.parse(searchParams);
    
    const messages = await messageService.getMessages(filters);
    
    return NextResponse.json<ApiResponse<UnifiedMessage[]>>({
      success: true,
      data: messages,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

**File: `src/app/api/messages/send/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { messageService } from '@/lib/services/message.service';
import { sendMessageSchema } from '@/lib/utils/validation';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const body = await request.json();
    const validated = sendMessageSchema.parse(body);
    
    const result = await messageService.sendMessage(validated);
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse<{ messageId?: string }>>({
      success: true,
      data: result.data,
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

### 7.3 OAuth Endpoints

**File: `src/app/api/oauth/google/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { gmailProvider } from '@/lib/providers/gmail.provider';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }
  
  const state = Buffer.from(JSON.stringify({ clientId })).toString('base64');
  const authUrl = gmailProvider.getAuthUrl(state);
  
  return NextResponse.redirect(authUrl);
}
```

**File: `src/app/api/oauth/google/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { gmailProvider } from '@/lib/providers/gmail.provider';
import { accountService } from '@/lib/services/account.service';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');
  
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/oauth-error?error=${error}`
    );
  }
  
  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/oauth-error?error=missing_params`
    );
  }
  
  try {
    const { clientId } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    const { accessToken, refreshToken, expiresAt, email } = 
      await gmailProvider.exchangeCode(code);
    
    const account = await accountService.createOAuthAccount(
      clientId,
      'gmail',
      email,
      accessToken,
      refreshToken,
      expiresAt
    );
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/oauth-success?accountId=${account.id}`
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/oauth-error?error=exchange_failed`
    );
  }
}
```

### 7.4 Sync Endpoint

**File: `src/app/api/sync/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, validateCronSecret } from '@/lib/middleware/auth';
import { syncService, SyncResult } from '@/lib/services/sync.service';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  const apiKeyError = validateApiKey(request);
  const cronError = validateCronSecret(request);
  
  if (apiKeyError && cronError) {
    return apiKeyError;
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId;
    
    let results: SyncResult[];
    
    if (accountId) {
      const result = await syncService.syncAccount(accountId);
      results = [result];
    } else {
      results = await syncService.syncAll();
    }
    
    const totalNew = results.reduce((sum, r) => sum + r.newMessages, 0);
    const failures = results.filter(r => !r.success).length;
    
    return NextResponse.json<ApiResponse<{ 
      results: SyncResult[]; 
      summary: { total: number; newMessages: number; failures: number } 
    }>>({
      success: true,
      data: {
        results,
        summary: { total: results.length, newMessages: totalNew, failures },
      },
    });
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const cronError = validateCronSecret(request);
  if (cronError) return cronError;
  
  try {
    const results = await syncService.syncAll();
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

## 8. Phase 5: Webhook Integration

### 8.1 Gmail Push Notifications (Optional)

**File: `src/app/api/webhooks/google/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { syncService } from '@/lib/services/sync.service';
import { getStorage } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const data = JSON.parse(
      Buffer.from(body.message.data, 'base64').toString()
    );
    
    const emailAddress = data.emailAddress;
    
    const storage = getStorage();
    const accounts = await storage.getAccounts();
    const account = accounts.find(a => a.emailAddress === emailAddress);
    
    if (account) {
      await syncService.syncAccount(account.id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Gmail webhook error:', error);
    return NextResponse.json({ success: true });
  }
}
```

---

## 9. Configuration Management

### 9.1 Vercel Cron Configuration

**File: `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## 10. Security Considerations

| Measure | Implementation |
|---------|----------------|
| Encryption at rest | AES-256-GCM for tokens and passwords |
| API key authentication | Required for all endpoints |
| Input validation | Zod schemas on all inputs |
| State parameter | CSRF protection in OAuth |
| No tokens in logs | Never log sensitive values |

---

## 11. Testing Strategy

### Manual Testing Checklist

- [ ] Create IMAP account with real credentials
- [ ] Complete Gmail OAuth flow
- [ ] Sync messages from each provider
- [ ] Send reply through each provider
- [ ] Verify threading works correctly
- [ ] Test token refresh
- [ ] Test error handling

---

## 12. Scaling Roadmap

### Phase 1 → Phase 2: Database Migration

When JSON files become a bottleneck, migrate to PostgreSQL or SQLite.

### Phase 2 → Phase 3: Queue System

Add Redis/BullMQ for reliable message sending.

### Phase 3 → Phase 4: Webhooks

Replace polling with Gmail Pub/Sub and Microsoft Graph webhooks.

---

## API Reference (Quick)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/accounts` | GET | List accounts |
| `/api/accounts` | POST | Create IMAP account |
| `/api/accounts/:id` | GET | Get account |
| `/api/accounts/:id` | DELETE | Delete account |
| `/api/oauth/google?clientId=X` | GET | Start Gmail OAuth |
| `/api/messages` | GET | List messages |
| `/api/messages/send` | POST | Send message |
| `/api/sync` | POST | Trigger sync |

All endpoints (except OAuth redirects) require `x-api-key` header.
