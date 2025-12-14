// ============================================================================
// Message Service
// ============================================================================
// Handles message retrieval, sending, and management.

import { v4 as uuid } from 'uuid';
import { getStorage } from '@/lib/storage';
import { getProvider } from '@/lib/providers';
import { accountService } from './account.service';
import { attachmentService } from './attachment.service';
import { 
  UnifiedMessage, 
  SendMessageRequest, 
  ApiResponse,
  MessageFilters,
  EmailAddress
} from '@/types';
import { SendAttachmentData } from '@/lib/providers/types';

// ============================================================================
// Message Service Class
// ============================================================================

class MessageService {
  private storage = getStorage();
  
  // =========================================================================
  // List Messages
  // =========================================================================
  
  /**
   * Get messages with filters
   */
  async getMessages(filters: MessageFilters): Promise<UnifiedMessage[]> {
    return this.storage.getMessages(filters);
  }
  
  /**
   * Count messages matching filters
   */
  async countMessages(filters: MessageFilters): Promise<number> {
    return this.storage.countMessages(filters);
  }
  
  // =========================================================================
  // Get Single Message
  // =========================================================================
  
  /**
   * Get a message by ID
   */
  async getMessage(id: string): Promise<UnifiedMessage | null> {
    return this.storage.getMessage(id);
  }
  
  /**
   * Get a message by provider Message-ID
   */
  async getMessageByProviderId(
    accountId: string, 
    providerMessageId: string
  ): Promise<UnifiedMessage | null> {
    return this.storage.getMessageByProviderId(accountId, providerMessageId);
  }
  
  // =========================================================================
  // Get Thread
  // =========================================================================
  
  /**
   * Get all messages in a thread
   */
  async getThread(threadId: string): Promise<UnifiedMessage[]> {
    const messages = await this.storage.getMessages({ 
      threadId, 
      limit: 100 
    });
    
    // Sort by date ascending (oldest first) for thread view
    return messages.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
  
  // =========================================================================
  // Send Message
  // =========================================================================
  
  /**
   * Send a new email or reply
   */
  async sendMessage(request: SendMessageRequest): Promise<ApiResponse<{ 
    messageId?: string; 
    sentMessageId?: string;
  }>> {
    // Get account with credentials
    const account = await accountService.getAccountWithCredentials(request.accountId);
    
    if (!account) {
      return {
        success: false,
        error: 'Account not found',
      };
    }
    
    if (account.status !== 'active') {
      return {
        success: false,
        error: `Account is ${account.status}`,
      };
    }
    
    // Get provider
    const provider = getProvider(account.provider);
    
    // Build threading headers if this is a reply
    let inReplyToProviderMessageId: string | undefined;
    let references: string[] | undefined;
    let subject = request.subject;
    
    if (request.inReplyTo) {
      const originalMessage = await this.storage.getMessage(request.inReplyTo);
      
      if (originalMessage) {
        inReplyToProviderMessageId = originalMessage.providerMessageId;
        
        // Build references chain
        if (originalMessage.references) {
          references = [...originalMessage.references, originalMessage.providerMessageId];
        } else {
          references = [originalMessage.providerMessageId];
        }
        
        // Auto-prefix subject with Re: if not already
        if (!subject.toLowerCase().startsWith('re:')) {
          subject = `Re: ${originalMessage.subject}`;
        }
      }
    }
    
    // Process attachments
    const attachments: SendAttachmentData[] = [];
    
    if (request.attachments && request.attachments.length > 0) {
      for (const att of request.attachments) {
        attachments.push({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType,
        });
      }
    }
    
    // Send via provider
    const result = await provider.sendMessage(account, {
      to: request.to,
      cc: request.cc,
      bcc: request.bcc,
      subject,
      bodyText: request.bodyText,
      bodyHtml: request.bodyHtml,
      inReplyTo: inReplyToProviderMessageId,
      references,
      attachments,
    });
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send message',
      };
    }
    
    // Create outgoing message record
    const messageId = uuid();
    
    const outgoingMessage: UnifiedMessage = {
      id: messageId,
      accountId: account.id,
      clientId: account.clientId,
      providerMessageId: result.messageId || messageId,
      
      // Threading
      threadId: references?.[0] || result.messageId || messageId,
      inReplyTo: inReplyToProviderMessageId,
      references,
      
      // Envelope
      from: {
        address: account.emailAddress,
        name: account.displayName,
      },
      to: request.to,
      cc: request.cc,
      
      subject,
      
      bodyText: request.bodyText,
      bodyHtml: request.bodyHtml,
      
      // Metadata
      date: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      isRead: true,
      isOutgoing: true,
      status: 'replied',
      
      // Attachments
      hasAttachments: attachments.length > 0,
      
      syncedAt: new Date().toISOString(),
    };
    
    // Save sent message
    await this.storage.saveMessage(outgoingMessage);
    
    // If this was a reply, update original message status
    if (request.inReplyTo) {
      await this.storage.updateMessage(request.inReplyTo, {
        status: 'replied',
        isRead: true,
      });
    }
    
    return {
      success: true,
      data: {
        messageId,
        sentMessageId: result.messageId,
      },
    };
  }
  
  // =========================================================================
  // Update Message
  // =========================================================================
  
  /**
   * Mark message as read
   */
  async markAsRead(id: string): Promise<void> {
    await this.storage.updateMessage(id, {
      isRead: true,
      status: 'read',
    });
  }
  
  /**
   * Mark message as unread
   */
  async markAsUnread(id: string): Promise<void> {
    await this.storage.updateMessage(id, {
      isRead: false,
      status: 'new',
    });
  }
  
  /**
   * Archive message
   */
  async archiveMessage(id: string): Promise<void> {
    await this.storage.updateMessage(id, {
      status: 'archived',
    });
  }
  
  // =========================================================================
  // Delete Message
  // =========================================================================
  
  /**
   * Delete a message and its attachments
   */
  async deleteMessage(id: string): Promise<void> {
    const message = await this.storage.getMessage(id);
    
    if (!message) {
      throw new Error('Message not found');
    }
    
    // Delete attachments from filesystem
    if (message.hasAttachments) {
      await attachmentService.deleteMessageAttachments(
        message.accountId, 
        message.id
      );
    }
    
    // Delete message record
    await this.storage.deleteMessage(id);
  }
  
  // =========================================================================
  // Helper Methods
  // =========================================================================
  
  /**
   * Get messages for a specific contact (from or to)
   */
  async getMessagesForContact(
    accountId: string,
    contactEmail: string,
    limit = 50
  ): Promise<UnifiedMessage[]> {
    const allMessages = await this.storage.getMessages({
      accountId,
      limit: 500, // Get more to filter
    });
    
    const contactMessages = allMessages.filter(m => {
      const emailLower = contactEmail.toLowerCase();
      
      // Check from
      if (m.from.address.toLowerCase() === emailLower) return true;
      
      // Check to
      if (m.to.some(t => t.address.toLowerCase() === emailLower)) return true;
      
      // Check cc
      if (m.cc?.some(c => c.address.toLowerCase() === emailLower)) return true;
      
      return false;
    });
    
    return contactMessages.slice(0, limit);
  }
}

// Export singleton instance
export const messageService = new MessageService();

