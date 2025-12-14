// ============================================================================
// Core Types for Email Service
// ============================================================================

// Provider types - extensible for Phase 2
export type EmailProviderType = 'imap' | 'gmail' | 'microsoft';

// Account status
export type AccountStatus = 'active' | 'error' | 'disconnected' | 'pending';

// Message status for tracking
export type MessageStatus = 'new' | 'read' | 'replied' | 'archived';

// Conversation status
export type ConversationStatus = 'open' | 'closed' | 'archived';

// ============================================================================
// Account Types
// ============================================================================

export interface ConnectedAccount {
  id: string;
  clientId: string;                    // Multi-tenant: identifies which client owns this account
  provider: EmailProviderType;
  emailAddress: string;
  displayName?: string;
  
  // IMAP/SMTP credentials (encrypted at rest)
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string;                   // Encrypted
  useTls?: boolean;
  
  // OAuth tokens (Phase 2 - for Gmail/Microsoft)
  accessToken?: string;                // Encrypted
  refreshToken?: string;               // Encrypted
  tokenExpiresAt?: string;             // ISO date string
  
  // Status tracking
  status: AccountStatus;
  lastError?: string;
  lastSyncAt?: string;                 // ISO date string
  
  // Metadata
  createdAt: string;                   // ISO date string
  updatedAt: string;                   // ISO date string
}

// ============================================================================
// Message Types
// ============================================================================

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface AttachmentInfo {
  id: string;                          // Unique ID for retrieval
  messageId: string;                   // Parent message ID
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;                  // For inline images (cid:xxx)
  isInline: boolean;
  storagePath: string;                 // Path in filesystem
}

export interface UnifiedMessage {
  id: string;                          // Internal unique ID
  accountId: string;                   // Which account this belongs to
  clientId: string;                    // Which client owns this (denormalized for easier queries)
  
  // Provider-specific ID for deduplication
  providerMessageId: string;           // The Message-ID header from email
  
  // Conversation linking
  conversationId?: string;             // Which conversation this belongs to
  
  // Threading
  threadId?: string;                   // For grouping related messages
  inReplyTo?: string;                  // Message-ID this is replying to
  references?: string[];               // Chain of Message-IDs in thread
  
  // Envelope
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  
  subject: string;
  
  // Body content
  bodyText?: string;
  bodyHtml?: string;
  
  // Metadata
  date: string;                        // ISO date string - when email was sent
  receivedAt: string;                  // ISO date string - when we received it
  isRead: boolean;
  isOutgoing: boolean;                 // true = we sent it, false = incoming
  status: MessageStatus;
  
  // Attachments
  hasAttachments: boolean;
  attachments?: AttachmentInfo[];
  
  // Sync tracking
  syncedAt: string;                    // ISO date string
  providerUid?: string;                // IMAP UID for tracking
}

// ============================================================================
// Sync State
// ============================================================================

export interface SyncState {
  accountId: string;
  lastUid?: number;                    // Last IMAP UID processed
  lastSyncAt?: string;                 // ISO date string
  
  // Provider-specific state (Phase 2)
  historyId?: string;                  // Gmail history ID
  deltaLink?: string;                  // Microsoft delta link
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateAccountRequest {
  clientId: string;
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

export interface SendMessageRequest {
  accountId: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;                  // Message ID to reply to (our internal ID)
  attachments?: SendAttachment[];
}

export interface SendAttachment {
  filename: string;
  content: string;                     // Base64 encoded
  contentType: string;
}

export interface SyncRequest {
  accountId?: string;                  // Optional: sync specific account, or all if omitted
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface SyncResult {
  accountId: string;
  success: boolean;
  newMessages: number;
  error?: string;
}

export interface SyncResponse {
  results: SyncResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    newMessages: number;
  };
}

// ============================================================================
// Message Filters for Queries
// ============================================================================

export interface MessageFilters {
  accountId?: string;
  clientId?: string;
  since?: string;                      // ISO date
  until?: string;                      // ISO date
  threadId?: string;
  conversationId?: string;             // Filter by conversation
  isRead?: boolean;
  isOutgoing?: boolean;
  hasAttachments?: boolean;
  limit?: number;
  offset?: number;
  search?: string;                     // Search in subject/body (Phase 2)
}

// ============================================================================
// Conversation Types
// ============================================================================

export interface Conversation {
  id: string;                          // Unique ID
  accountId: string;                   // Which email account
  clientId: string;                    // Multi-tenant identifier
  
  // Display
  subject: string;                     // Normalized subject (without Re:, Fwd:)
  snippet: string;                     // Preview of last message (first ~100 chars)
  
  // Participants
  participants: EmailAddress[];        // All people involved in the conversation
  lastSender: EmailAddress;            // Who sent the last message
  
  // Status
  status: ConversationStatus;
  
  // Counts
  messageCount: number;
  unreadCount: number;
  
  // Timestamps
  lastMessageAt: string;               // ISO date of last message
  createdAt: string;                   // When conversation started
  closedAt?: string;                   // When conversation was closed (if closed)
  
  // For matching incoming emails to this conversation
  threadIds: string[];                 // All Message-IDs that belong to this thread
}

// For API responses with embedded messages
export interface ConversationWithMessages extends Conversation {
  messages: UnifiedMessage[];
}

export interface ConversationFilters {
  accountId?: string;
  clientId?: string;
  status?: ConversationStatus;
  limit?: number;
  offset?: number;
  search?: string;                     // Search in subject/participants
}

