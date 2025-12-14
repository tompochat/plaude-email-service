// ============================================================================
// JSON File Storage Implementation
// ============================================================================
// Simple file-based storage for Phase 1. Uses JSON files with file locking
// to prevent concurrent write issues.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { StorageAdapter } from './types';
import { 
  ConnectedAccount, 
  UnifiedMessage, 
  SyncState,
  MessageFilters,
  AttachmentInfo,
  Conversation,
  ConversationFilters
} from '@/types';

// ============================================================================
// Configuration
// ============================================================================

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const SYNC_STATE_FILE = path.join(DATA_DIR, 'sync-state.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

// ============================================================================
// File Operations with Locking
// ============================================================================

// Simple write lock to prevent concurrent writes
const writeLocks: Map<string, Promise<void>> = new Map();

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function readJsonFile<T>(filepath: string, defaultValue: T): Promise<T> {
  await ensureDataDir();
  try {
    const content = await readFile(filepath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    // File doesn't exist or is invalid - return default
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultValue;
    }
    console.error(`Error reading ${filepath}:`, error);
    return defaultValue;
  }
}

async function writeJsonFile<T>(filepath: string, data: T): Promise<void> {
  await ensureDataDir();
  
  // Get or create lock for this file
  const existingLock = writeLocks.get(filepath) || Promise.resolve();
  
  const newLock = existingLock.then(async () => {
    await writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  });
  
  writeLocks.set(filepath, newLock);
  await newLock;
}

// ============================================================================
// JSON Storage Implementation
// ============================================================================

export class JsonStorage implements StorageAdapter {
  
  // =========================================================================
  // Account Operations
  // =========================================================================
  
  async getAccounts(clientId?: string): Promise<ConnectedAccount[]> {
    const accounts = await readJsonFile<ConnectedAccount[]>(ACCOUNTS_FILE, []);
    if (clientId) {
      return accounts.filter(a => a.clientId === clientId);
    }
    return accounts;
  }
  
  async getAccount(id: string): Promise<ConnectedAccount | null> {
    const accounts = await this.getAccounts();
    return accounts.find(a => a.id === id) || null;
  }
  
  async getAccountsByClient(clientId: string): Promise<ConnectedAccount[]> {
    return this.getAccounts(clientId);
  }
  
  async saveAccount(account: ConnectedAccount): Promise<void> {
    const accounts = await readJsonFile<ConnectedAccount[]>(ACCOUNTS_FILE, []);
    const index = accounts.findIndex(a => a.id === account.id);
    
    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }
    
    await writeJsonFile(ACCOUNTS_FILE, accounts);
  }
  
  async deleteAccount(id: string): Promise<void> {
    const accounts = await readJsonFile<ConnectedAccount[]>(ACCOUNTS_FILE, []);
    const filtered = accounts.filter(a => a.id !== id);
    await writeJsonFile(ACCOUNTS_FILE, filtered);
  }

  // =========================================================================
  // Message Operations
  // =========================================================================
  
  async getMessages(filters: MessageFilters): Promise<UnifiedMessage[]> {
    let messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    
    // Apply filters
    if (filters.accountId) {
      messages = messages.filter(m => m.accountId === filters.accountId);
    }
    
    if (filters.clientId) {
      messages = messages.filter(m => m.clientId === filters.clientId);
    }
    
    if (filters.threadId) {
      messages = messages.filter(m => m.threadId === filters.threadId);
    }
    
    if (filters.conversationId) {
      messages = messages.filter(m => m.conversationId === filters.conversationId);
    }
    
    if (filters.since) {
      const sinceDate = new Date(filters.since);
      messages = messages.filter(m => new Date(m.date) >= sinceDate);
    }
    
    if (filters.until) {
      const untilDate = new Date(filters.until);
      messages = messages.filter(m => new Date(m.date) <= untilDate);
    }
    
    if (filters.isRead !== undefined) {
      messages = messages.filter(m => m.isRead === filters.isRead);
    }
    
    if (filters.isOutgoing !== undefined) {
      messages = messages.filter(m => m.isOutgoing === filters.isOutgoing);
    }
    
    if (filters.hasAttachments !== undefined) {
      messages = messages.filter(m => m.hasAttachments === filters.hasAttachments);
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
  
  async getMessageByProviderId(accountId: string, providerMessageId: string): Promise<UnifiedMessage | null> {
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    return messages.find(m => 
      m.accountId === accountId && m.providerMessageId === providerMessageId
    ) || null;
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
    if (newMessages.length === 0) return;
    
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
  
  async updateMessage(id: string, updates: Partial<UnifiedMessage>): Promise<void> {
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    const index = messages.findIndex(m => m.id === id);
    
    if (index >= 0) {
      messages[index] = { ...messages[index], ...updates };
      await writeJsonFile(MESSAGES_FILE, messages);
    }
  }
  
  async deleteMessage(id: string): Promise<void> {
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    const filtered = messages.filter(m => m.id !== id);
    await writeJsonFile(MESSAGES_FILE, filtered);
  }
  
  async countMessages(filters: MessageFilters): Promise<number> {
    const messages = await this.getMessages({ ...filters, limit: undefined, offset: undefined });
    return messages.length;
  }

  // =========================================================================
  // Sync State Operations
  // =========================================================================
  
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

  // =========================================================================
  // Attachment Operations
  // =========================================================================
  
  async getAttachment(id: string): Promise<AttachmentInfo | null> {
    // Attachments are stored embedded in messages, so we need to search
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    
    for (const message of messages) {
      if (message.attachments) {
        const attachment = message.attachments.find(a => a.id === id);
        if (attachment) {
          return attachment;
        }
      }
    }
    
    return null;
  }
  
  async getAttachmentsByMessage(messageId: string): Promise<AttachmentInfo[]> {
    const message = await this.getMessage(messageId);
    return message?.attachments || [];
  }

  // =========================================================================
  // Conversation Operations
  // =========================================================================
  
  async getConversations(filters: ConversationFilters): Promise<Conversation[]> {
    let conversations = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE, []);
    
    // Apply filters
    if (filters.accountId) {
      conversations = conversations.filter(c => c.accountId === filters.accountId);
    }
    
    if (filters.clientId) {
      conversations = conversations.filter(c => c.clientId === filters.clientId);
    }
    
    if (filters.status) {
      conversations = conversations.filter(c => c.status === filters.status);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      conversations = conversations.filter(c => 
        c.subject.toLowerCase().includes(searchLower) ||
        c.participants.some(p => 
          p.address.toLowerCase().includes(searchLower) ||
          p.name?.toLowerCase().includes(searchLower)
        )
      );
    }
    
    // Sort by last message (newest first)
    conversations.sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
    
    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    
    return conversations.slice(offset, offset + limit);
  }
  
  async getConversation(id: string): Promise<Conversation | null> {
    const conversations = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE, []);
    return conversations.find(c => c.id === id) || null;
  }
  
  async getConversationByThreadId(accountId: string, threadId: string): Promise<Conversation | null> {
    const conversations = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE, []);
    return conversations.find(c => 
      c.accountId === accountId && 
      c.threadIds.includes(threadId)
    ) || null;
  }
  
  async saveConversation(conversation: Conversation): Promise<void> {
    const conversations = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE, []);
    const index = conversations.findIndex(c => c.id === conversation.id);
    
    if (index >= 0) {
      conversations[index] = conversation;
    } else {
      conversations.push(conversation);
    }
    
    await writeJsonFile(CONVERSATIONS_FILE, conversations);
  }
  
  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    const conversations = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE, []);
    const index = conversations.findIndex(c => c.id === id);
    
    if (index >= 0) {
      conversations[index] = { ...conversations[index], ...updates };
      await writeJsonFile(CONVERSATIONS_FILE, conversations);
    }
  }
  
  async deleteConversation(id: string): Promise<void> {
    const conversations = await readJsonFile<Conversation[]>(CONVERSATIONS_FILE, []);
    const filtered = conversations.filter(c => c.id !== id);
    await writeJsonFile(CONVERSATIONS_FILE, filtered);
  }
  
  async countConversations(filters: ConversationFilters): Promise<number> {
    const conversations = await this.getConversations({ 
      ...filters, 
      limit: undefined, 
      offset: undefined 
    });
    return conversations.length;
  }
  
  async getConversationMessages(conversationId: string): Promise<UnifiedMessage[]> {
    const messages = await readJsonFile<UnifiedMessage[]>(MESSAGES_FILE, []);
    const conversationMessages = messages.filter(m => m.conversationId === conversationId);
    
    // Sort chronologically (oldest first for conversation view)
    conversationMessages.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    return conversationMessages;
  }
}

