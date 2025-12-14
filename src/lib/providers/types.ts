// ============================================================================
// Email Provider Interface
// ============================================================================
// Strategy pattern: All email providers implement this interface.
// This allows easy addition of new providers (Gmail, Microsoft) in Phase 2.

import { 
  ConnectedAccount, 
  UnifiedMessage, 
  SyncState,
  AttachmentInfo
} from '@/types';

// ============================================================================
// Fetch Options and Results
// ============================================================================

export interface FetchOptions {
  /** Fetch messages since this date */
  since?: Date;
  
  /** Maximum number of messages to fetch */
  maxResults?: number;
  
  /** Previous sync state for incremental fetching */
  syncState?: SyncState;
  
  /** Whether to mark fetched messages as read on the server */
  markAsRead?: boolean;
  
  /** Account creation date - don't fetch emails before this */
  accountCreatedAt?: Date;
}

export interface FetchResult {
  /** Fetched messages (normalized) */
  messages: UnifiedMessage[];
  
  /** New sync state to save for next fetch */
  newSyncState: Partial<SyncState>;
  
  /** Total count of messages available (if known) */
  totalAvailable?: number;
}

// ============================================================================
// Send Options and Results
// ============================================================================

export interface SendOptions {
  to: { address: string; name?: string }[];
  cc?: { address: string; name?: string }[];
  bcc?: { address: string; name?: string }[];
  replyTo?: { address: string; name?: string };
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  
  // Threading headers
  inReplyTo?: string;       // Message-ID of the email being replied to
  references?: string[];    // Chain of Message-IDs in the thread
  
  // Attachments
  attachments?: SendAttachmentData[];
}

export interface SendAttachmentData {
  filename: string;
  content: Buffer;
  contentType: string;
  contentId?: string;       // For inline attachments
}

export interface SendResult {
  success: boolean;
  messageId?: string;       // The Message-ID of the sent email
  providerMessageId?: string; // Provider-specific ID (e.g., Gmail thread ID)
  error?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface EmailProvider {
  /**
   * Provider type identifier
   */
  readonly type: string;
  
  /**
   * Test if the connection credentials are valid
   * @param account Account with credentials to test
   * @returns true if connection successful
   */
  testConnection(account: ConnectedAccount): Promise<boolean>;
  
  /**
   * Fetch messages from the account
   * @param account Account to fetch from
   * @param options Fetch options (since date, max results, etc.)
   * @returns Fetched messages and new sync state
   */
  fetchMessages(
    account: ConnectedAccount, 
    options: FetchOptions
  ): Promise<FetchResult>;
  
  /**
   * Send an email message
   * @param account Account to send from
   * @param options Message options (to, subject, body, etc.)
   * @returns Result with success status and message ID
   */
  sendMessage(
    account: ConnectedAccount, 
    options: SendOptions
  ): Promise<SendResult>;
  
  /**
   * Get a specific message by its provider ID
   * @param account Account to fetch from
   * @param providerMessageId Provider-specific message ID
   * @returns The message or null if not found
   */
  getMessage?(
    account: ConnectedAccount,
    providerMessageId: string
  ): Promise<UnifiedMessage | null>;
  
  /**
   * Download an attachment
   * @param account Account to fetch from
   * @param attachment Attachment info
   * @returns Attachment content as Buffer
   */
  downloadAttachment?(
    account: ConnectedAccount,
    attachment: AttachmentInfo
  ): Promise<Buffer>;
  
  /**
   * Refresh OAuth token (for OAuth-based providers)
   * @param account Account with refresh token
   * @returns New access token and expiry
   */
  refreshToken?(account: ConnectedAccount): Promise<{
    accessToken: string;
    expiresAt: Date;
  }>;
}

// ============================================================================
// Provider Error Types
// ============================================================================

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class AuthenticationError extends ProviderError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', false);
    this.name = 'AuthenticationError';
  }
}

export class ConnectionError extends ProviderError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR', true);
    this.name = 'ConnectionError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT', true);
    this.name = 'RateLimitError';
  }
}

