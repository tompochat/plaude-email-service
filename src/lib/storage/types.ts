// ============================================================================
// Storage Adapter Interface
// ============================================================================
// This interface abstracts storage operations, allowing easy migration from
// JSON files (Phase 1) to PostgreSQL (Phase 2) without changing service code.

import { 
  ConnectedAccount, 
  UnifiedMessage, 
  SyncState,
  MessageFilters,
  AttachmentInfo,
  Conversation,
  ConversationFilters
} from '@/types';

export interface StorageAdapter {
  // =========================================================================
  // Account Operations
  // =========================================================================
  
  /**
   * Get all accounts, optionally filtered by clientId
   */
  getAccounts(clientId?: string): Promise<ConnectedAccount[]>;
  
  /**
   * Get a single account by ID
   */
  getAccount(id: string): Promise<ConnectedAccount | null>;
  
  /**
   * Get accounts for a specific client
   */
  getAccountsByClient(clientId: string): Promise<ConnectedAccount[]>;
  
  /**
   * Create or update an account
   */
  saveAccount(account: ConnectedAccount): Promise<void>;
  
  /**
   * Delete an account by ID
   */
  deleteAccount(id: string): Promise<void>;

  // =========================================================================
  // Message Operations
  // =========================================================================
  
  /**
   * Get messages with optional filters
   */
  getMessages(filters: MessageFilters): Promise<UnifiedMessage[]>;
  
  /**
   * Get a single message by ID
   */
  getMessage(id: string): Promise<UnifiedMessage | null>;
  
  /**
   * Get a message by its provider-specific Message-ID
   */
  getMessageByProviderId(accountId: string, providerMessageId: string): Promise<UnifiedMessage | null>;
  
  /**
   * Save a single message (create or update)
   */
  saveMessage(message: UnifiedMessage): Promise<void>;
  
  /**
   * Save multiple messages at once
   */
  saveMessages(messages: UnifiedMessage[]): Promise<void>;
  
  /**
   * Update message status/read state
   */
  updateMessage(id: string, updates: Partial<UnifiedMessage>): Promise<void>;
  
  /**
   * Delete a message by ID
   */
  deleteMessage(id: string): Promise<void>;
  
  /**
   * Get total count of messages matching filters
   */
  countMessages(filters: MessageFilters): Promise<number>;

  // =========================================================================
  // Sync State Operations
  // =========================================================================
  
  /**
   * Get sync state for an account
   */
  getSyncState(accountId: string): Promise<SyncState | null>;
  
  /**
   * Save sync state for an account
   */
  saveSyncState(state: SyncState): Promise<void>;

  // =========================================================================
  // Attachment Operations (metadata only - files stored separately)
  // =========================================================================
  
  /**
   * Get attachment metadata by ID
   */
  getAttachment(id: string): Promise<AttachmentInfo | null>;
  
  /**
   * Get all attachments for a message
   */
  getAttachmentsByMessage(messageId: string): Promise<AttachmentInfo[]>;

  // =========================================================================
  // Conversation Operations
  // =========================================================================
  
  /**
   * Get conversations with filters
   */
  getConversations(filters: ConversationFilters): Promise<Conversation[]>;
  
  /**
   * Get a single conversation by ID
   */
  getConversation(id: string): Promise<Conversation | null>;
  
  /**
   * Find conversation by thread ID (for matching incoming messages)
   */
  getConversationByThreadId(accountId: string, threadId: string): Promise<Conversation | null>;
  
  /**
   * Save a conversation (create or update)
   */
  saveConversation(conversation: Conversation): Promise<void>;
  
  /**
   * Update conversation (partial update)
   */
  updateConversation(id: string, updates: Partial<Conversation>): Promise<void>;
  
  /**
   * Delete a conversation
   */
  deleteConversation(id: string): Promise<void>;
  
  /**
   * Count conversations matching filters
   */
  countConversations(filters: ConversationFilters): Promise<number>;
  
  /**
   * Get messages for a conversation
   */
  getConversationMessages(conversationId: string): Promise<UnifiedMessage[]>;
}

// ============================================================================
// Storage Configuration
// ============================================================================

export interface StorageConfig {
  type: 'json' | 'postgres';
  
  // JSON storage config
  dataDir?: string;
  
  // PostgreSQL config (Phase 2)
  connectionString?: string;
}

