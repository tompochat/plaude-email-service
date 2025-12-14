// ============================================================================
// Conversation Service
// ============================================================================
// Manages conversation lifecycle, grouping, and status

import { v4 as uuid } from 'uuid';
import { getStorage } from '@/lib/storage';
import { 
  Conversation, 
  ConversationFilters, 
  ConversationWithMessages,
  UnifiedMessage,
  EmailAddress
} from '@/types';

class ConversationService {
  private storage = getStorage();

  // =========================================================================
  // Query Methods
  // =========================================================================
  
  /**
   * Get conversations with filters
   */
  async getConversations(filters: ConversationFilters): Promise<Conversation[]> {
    return this.storage.getConversations(filters);
  }

  /**
   * Get a single conversation with its messages
   */
  async getConversation(id: string): Promise<ConversationWithMessages | null> {
    const conversation = await this.storage.getConversation(id);
    if (!conversation) return null;
    
    const messages = await this.storage.getConversationMessages(id);
    
    return { ...conversation, messages };
  }

  /**
   * Count conversations matching filters
   */
  async countConversations(filters: ConversationFilters): Promise<number> {
    return this.storage.countConversations(filters);
  }

  // =========================================================================
  // Conversation Matching
  // =========================================================================
  
  /**
   * Find or create a conversation for a message
   * This is the core grouping logic
   */
  async findOrCreateConversation(message: UnifiedMessage): Promise<Conversation> {
    // 1. Try to find existing conversation by thread references
    let conversation = await this.findConversationForMessage(message);
    
    if (conversation) {
      // If found but closed, reopen it (new message means active conversation)
      if (conversation.status === 'closed') {
        await this.reopenConversation(conversation.id);
        conversation.status = 'open';
        conversation.closedAt = undefined;
      }
      return conversation;
    }
    
    // 2. No existing conversation, create a new one
    return this.createConversationFromMessage(message);
  }

  /**
   * Find existing conversation for a message based on threading
   */
  private async findConversationForMessage(message: UnifiedMessage): Promise<Conversation | null> {
    // Check by inReplyTo
    if (message.inReplyTo) {
      const conv = await this.storage.getConversationByThreadId(
        message.accountId, 
        message.inReplyTo
      );
      if (conv) return conv;
    }
    
    // Check by references (any reference might match)
    if (message.references && message.references.length > 0) {
      for (const ref of message.references) {
        const conv = await this.storage.getConversationByThreadId(
          message.accountId, 
          ref
        );
        if (conv) return conv;
      }
    }
    
    // Check by providerMessageId (message might be the thread starter)
    const conv = await this.storage.getConversationByThreadId(
      message.accountId, 
      message.providerMessageId
    );
    if (conv) return conv;
    
    return null;
  }

  /**
   * Create a new conversation from a message
   */
  private async createConversationFromMessage(message: UnifiedMessage): Promise<Conversation> {
    const conversation: Conversation = {
      id: uuid(),
      accountId: message.accountId,
      clientId: message.clientId,
      subject: this.normalizeSubject(message.subject),
      snippet: this.createSnippet(message.bodyText || ''),
      participants: this.extractParticipants(message),
      lastSender: message.from,
      status: 'open',
      messageCount: 1,
      unreadCount: message.isRead ? 0 : 1,
      lastMessageAt: message.date,
      createdAt: message.date,
      threadIds: [message.providerMessageId],
    };
    
    await this.storage.saveConversation(conversation);
    return conversation;
  }

  // =========================================================================
  // Conversation Updates
  // =========================================================================
  
  /**
   * Add a message to an existing conversation
   * Called when a message is added to an existing conversation (not when creating)
   */
  async addMessageToConversation(
    conversationId: string, 
    message: UnifiedMessage
  ): Promise<void> {
    const conversation = await this.storage.getConversation(conversationId);
    if (!conversation) return;
    
    // Update conversation metadata
    const updates: Partial<Conversation> = {
      snippet: this.createSnippet(message.bodyText || ''),
      lastSender: message.from,
      lastMessageAt: message.date,
      messageCount: conversation.messageCount + 1,
      unreadCount: message.isRead 
        ? conversation.unreadCount 
        : conversation.unreadCount + 1,
    };
    
    // Add new thread ID if not already present
    if (!conversation.threadIds.includes(message.providerMessageId)) {
      updates.threadIds = [...conversation.threadIds, message.providerMessageId];
    }
    
    // Add new participants
    const newParticipants = this.extractParticipants(message);
    const existingAddresses = new Set(conversation.participants.map(p => p.address.toLowerCase()));
    const uniqueNewParticipants = newParticipants.filter(
      p => !existingAddresses.has(p.address.toLowerCase())
    );
    if (uniqueNewParticipants.length > 0) {
      updates.participants = [...conversation.participants, ...uniqueNewParticipants];
    }
    
    await this.storage.updateConversation(conversationId, updates);
  }

  /**
   * Close a conversation
   */
  async closeConversation(id: string): Promise<{ success: boolean; error?: string }> {
    const conversation = await this.storage.getConversation(id);
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }
    
    await this.storage.updateConversation(id, {
      status: 'closed',
      closedAt: new Date().toISOString(),
    });
    
    return { success: true };
  }

  /**
   * Reopen a closed conversation
   */
  async reopenConversation(id: string): Promise<{ success: boolean; error?: string }> {
    const conversation = await this.storage.getConversation(id);
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }
    
    await this.storage.updateConversation(id, {
      status: 'open',
      closedAt: undefined,
    });
    
    return { success: true };
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(id: string): Promise<{ success: boolean; error?: string }> {
    const conversation = await this.storage.getConversation(id);
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }
    
    await this.storage.updateConversation(id, {
      status: 'archived',
    });
    
    return { success: true };
  }

  /**
   * Update unread count when messages are read
   */
  async markConversationAsRead(id: string): Promise<void> {
    // Also mark all messages in the conversation as read
    const messages = await this.storage.getConversationMessages(id);
    for (const message of messages) {
      if (!message.isRead) {
        await this.storage.updateMessage(message.id, { isRead: true, status: 'read' });
      }
    }
    
    await this.storage.updateConversation(id, { unreadCount: 0 });
  }

  /**
   * Decrement unread count by 1
   */
  async decrementUnreadCount(id: string): Promise<void> {
    const conversation = await this.storage.getConversation(id);
    if (conversation && conversation.unreadCount > 0) {
      await this.storage.updateConversation(id, {
        unreadCount: conversation.unreadCount - 1
      });
    }
  }

  /**
   * Recalculate conversation stats (useful after message deletion)
   */
  async recalculateStats(id: string): Promise<void> {
    const messages = await this.storage.getConversationMessages(id);
    
    if (messages.length === 0) {
      // No messages left, delete the conversation
      await this.storage.deleteConversation(id);
      return;
    }
    
    const unreadCount = messages.filter(m => !m.isRead).length;
    const lastMessage = messages[messages.length - 1];
    
    // Rebuild thread IDs from messages
    const threadIds = Array.from(new Set(messages.map(m => m.providerMessageId)));
    
    // Rebuild participants
    const participantMap = new Map<string, EmailAddress>();
    for (const msg of messages) {
      const allParticipants = [msg.from, ...msg.to, ...(msg.cc || [])];
      for (const p of allParticipants) {
        const key = p.address.toLowerCase();
        if (!participantMap.has(key)) {
          participantMap.set(key, p);
        }
      }
    }
    
    await this.storage.updateConversation(id, {
      messageCount: messages.length,
      unreadCount,
      lastMessageAt: lastMessage.date,
      lastSender: lastMessage.from,
      snippet: this.createSnippet(lastMessage.bodyText || ''),
      threadIds,
      participants: Array.from(participantMap.values()),
    });
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(id: string): Promise<{ success: boolean; error?: string }> {
    const conversation = await this.storage.getConversation(id);
    if (!conversation) {
      return { success: false, error: 'Conversation not found' };
    }
    
    // Delete all messages in the conversation
    const messages = await this.storage.getConversationMessages(id);
    for (const message of messages) {
      await this.storage.deleteMessage(message.id);
    }
    
    // Delete the conversation
    await this.storage.deleteConversation(id);
    
    return { success: true };
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================
  
  /**
   * Normalize subject by removing Re:, Fwd:, etc.
   */
  private normalizeSubject(subject: string): string {
    return subject
      .replace(/^(re|fwd|fw|aw|sv|vs|tr):\s*/gi, '')
      .replace(/^(re|fwd|fw|aw|sv|vs|tr)\[\d+\]:\s*/gi, '')
      .trim() || '(No subject)';
  }

  /**
   * Create a snippet from message body
   */
  private createSnippet(bodyText: string, maxLength = 100): string {
    const cleaned = bodyText
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .replace(/^>+.*$/gm, '')    // Remove quoted lines
      .trim();
    
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength) + '...';
  }

  /**
   * Extract unique participants from a message
   */
  private extractParticipants(message: UnifiedMessage): EmailAddress[] {
    const participants: EmailAddress[] = [message.from];
    
    if (message.to) {
      participants.push(...message.to);
    }
    
    if (message.cc) {
      participants.push(...message.cc);
    }
    
    // Deduplicate by email address
    const seen = new Set<string>();
    return participants.filter(p => {
      const key = p.address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const conversationService = new ConversationService();
