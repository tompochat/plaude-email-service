// ============================================================================
// IMAP/SMTP Provider Implementation
// ============================================================================
// Handles email fetching via IMAP and sending via SMTP using
// imapflow, nodemailer, and mailparser libraries.

import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, ParsedMail, Attachment as ParsedAttachment } from 'mailparser';
import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { v4 as uuid } from 'uuid';
import { 
  EmailProvider, 
  FetchOptions, 
  FetchResult, 
  SendOptions, 
  SendResult,
  AuthenticationError,
  ConnectionError
} from './types';
import { 
  ConnectedAccount, 
  UnifiedMessage, 
  EmailAddress,
  AttachmentInfo 
} from '@/types';
import { attachmentService } from '@/lib/services/attachment.service';

// ============================================================================
// IMAP Provider Class
// ============================================================================

export class ImapProvider implements EmailProvider {
  readonly type = 'imap';
  
  // =========================================================================
  // IMAP Client Creation
  // =========================================================================
  
  private createImapClient(account: ConnectedAccount): ImapFlow {
    if (!account.imapHost || !account.imapPort || !account.username || !account.password) {
      throw new Error('Missing IMAP credentials');
    }
    
    return new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.useTls ?? true,
      auth: {
        user: account.username,
        pass: account.password,
      },
      logger: false,
      // Increase timeouts to prevent disconnection during processing
      socketTimeout: 60000,      // 60 seconds socket timeout
      greetingTimeout: 30000,    // 30 seconds for initial greeting
      connectionTimeout: 30000,  // 30 seconds to establish connection
    });
  }
  
  // =========================================================================
  // SMTP Transport Creation
  // =========================================================================
  
  private createSmtpTransport(account: ConnectedAccount): nodemailer.Transporter {
    if (!account.smtpHost || !account.smtpPort || !account.username || !account.password) {
      throw new Error('Missing SMTP credentials');
    }
    
    return nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: account.username,
        pass: account.password,
      },
    });
  }
  
  // =========================================================================
  // Test Connection
  // =========================================================================
  
  async testConnection(account: ConnectedAccount): Promise<boolean> {
    const client = this.createImapClient(account);
    
    try {
      await client.connect();
      await client.logout();
      return true;
    } catch (error) {
      console.error('IMAP connection test failed:', error);
      return false;
    }
  }
  
  // =========================================================================
  // Fetch Messages
  // =========================================================================
  
  async fetchMessages(
    account: ConnectedAccount, 
    options: FetchOptions
  ): Promise<FetchResult> {
    const client = this.createImapClient(account);
    const messages: UnifiedMessage[] = [];
    let lastUid: number | undefined = options.syncState?.lastUid;
    
    console.log(`[IMAP] Starting fetch for ${account.emailAddress}`);
    const startTime = Date.now();
    
    try {
      await client.connect();
      console.log(`[IMAP] Connected in ${Date.now() - startTime}ms`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('auth') || message.includes('credentials')) {
        throw new AuthenticationError(`IMAP authentication failed: ${message}`);
      }
      throw new ConnectionError(`IMAP connection failed: ${message}`);
    }
    
    try {
      // Open INBOX with read-write access
      const lock = await client.getMailboxLock('INBOX');
      console.log(`[IMAP] Got mailbox lock in ${Date.now() - startTime}ms`);
      
      try {
        // Build search criteria
        const searchCriteria: Record<string, unknown> = {};
        
        // Fetch unseen messages by default
        searchCriteria.seen = false;
        
        // Use UID range if we have previous sync state (for incremental sync)
        if (lastUid) {
          searchCriteria.uid = `${lastUid + 1}:*`;
          console.log(`[IMAP] Incremental sync from UID ${lastUid + 1}`);
        } else {
          // IMPORTANT: Filter by account creation date to avoid fetching old emails
          const filterDate = options.accountCreatedAt || options.since;
          if (filterDate) {
            // imapflow expects a Date object for 'since'
            searchCriteria.since = filterDate instanceof Date ? filterDate : new Date(filterDate);
            console.log(`[IMAP] Filtering emails since: ${searchCriteria.since}`);
          }
        }
        
        console.log(`[IMAP] Search criteria:`, JSON.stringify(searchCriteria, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }));
        
        // First, just search to see how many messages match
        const searchStart = Date.now();
        
        const fetchOptions = {
          source: true,          // Get full email source for parsing
          uid: true,             // Get UID for sync tracking
          flags: true,           // Get read/unread status
          envelope: true,        // Get basic envelope info
        };
        
        let count = 0;
        const maxResults = Math.min(options.maxResults || 5, 10); // Max 10, default 5
        
        console.log(`[IMAP] Fetching up to ${maxResults} messages (requested: ${options.maxResults || 'default'})...`);
        
        // Fetch messages with timeout protection
        const fetchPromise = async () => {
          for await (const msg of client.fetch(searchCriteria, fetchOptions)) {
            if (count >= maxResults) {
              console.log(`[IMAP] Reached max ${maxResults} messages, stopping`);
              break;
            }
            
            console.log(`[IMAP] Processing message UID ${msg.uid} (${count + 1}/${maxResults})...`);
            
            try {
              const unified = await this.parseMessageFast(msg, account);
              
            if (unified) {
              messages.push(unified);
              count++;
              
              // Track the highest UID processed
              if (!lastUid || msg.uid > lastUid) {
                lastUid = msg.uid;
              }
              console.log(`[IMAP] ✓ Parsed message: "${unified.subject.substring(0, 50)}..."`);
            }
            
            // NOTE: Skipping mark-as-read for now to avoid timeouts
            // Gmail has aggressive timeouts and this operation can hang
            // TODO: Mark as read in a separate operation if needed
            } catch (parseError) {
              console.error(`[IMAP] ✗ Failed to parse message UID ${msg.uid}:`, parseError);
            }
          }
        };
        
        await fetchPromise();
        console.log(`[IMAP] Fetch completed in ${Date.now() - searchStart}ms, got ${count} messages`);
        
      } finally {
        lock.release();
      }
      
    } finally {
      await client.logout();
      console.log(`[IMAP] Total time: ${Date.now() - startTime}ms`);
    }
    
    return {
      messages,
      newSyncState: {
        lastUid,
        lastSyncAt: new Date().toISOString(),
      },
    };
  }
  
  // =========================================================================
  // Parse Email Message (Fast - skips attachment saving)
  // =========================================================================
  
  private async parseMessageFast(
    msg: FetchMessageObject, 
    account: ConnectedAccount
  ): Promise<UnifiedMessage | null> {
    // Check if source is available
    if (!msg.source) {
      console.warn('[IMAP] Message has no source, skipping');
      return null;
    }
    
    // Parse the raw email
    const parsed = await simpleParser(msg.source);
    
    if (!parsed.messageId) {
      console.warn('[IMAP] Message has no Message-ID, skipping');
      return null;
    }
    
    const messageId = uuid();
    const hasAttachments = (parsed.attachments?.length || 0) > 0;
    
    // Build unified message WITHOUT processing attachments for speed
    // Attachments can be fetched later on-demand
    const unified: UnifiedMessage = {
      id: messageId,
      accountId: account.id,
      clientId: account.clientId,
      providerMessageId: parsed.messageId,
      
      // Threading
      inReplyTo: parsed.inReplyTo || undefined,
      references: this.parseReferences(parsed.references),
      threadId: this.generateThreadId(parsed),
      
      // Envelope
      from: this.parseEmailAddress(parsed.from),
      to: this.parseEmailAddresses(parsed.to),
      cc: parsed.cc ? this.parseEmailAddresses(parsed.cc) : undefined,
      replyTo: parsed.replyTo ? this.parseEmailAddress(parsed.replyTo) : undefined,
      
      subject: parsed.subject || '(No Subject)',
      
      // Body
      bodyText: parsed.text || undefined,
      bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
      
      // Metadata
      date: (parsed.date || new Date()).toISOString(),
      receivedAt: new Date().toISOString(),
      isRead: false,
      isOutgoing: false,
      status: 'new',
      
      // Attachments - just metadata, not saved yet
      hasAttachments,
      attachments: hasAttachments ? parsed.attachments?.map((att, i) => ({
        id: `${messageId}_att_${i}`,
        messageId,
        filename: att.filename || `attachment_${i}`,
        mimeType: att.contentType,
        size: att.size,
        contentId: att.contentId || undefined,
        isInline: att.contentDisposition === 'inline',
        storagePath: '', // Not saved yet - will be populated on-demand
      })) : undefined,
      
      // Sync
      syncedAt: new Date().toISOString(),
      providerUid: msg.uid.toString(),
    };
    
    return unified;
  }
  
  // =========================================================================
  // Parse Email Message (Full - with attachment saving)
  // =========================================================================
  
  private async parseMessage(
    msg: FetchMessageObject, 
    account: ConnectedAccount
  ): Promise<UnifiedMessage | null> {
    // Check if source is available
    if (!msg.source) {
      console.warn('Message has no source, skipping');
      return null;
    }
    
    // Parse the raw email
    const parsed = await simpleParser(msg.source);
    
    if (!parsed.messageId) {
      console.warn('Message has no Message-ID, skipping');
      return null;
    }
    
    const messageId = uuid();
    
    // Process attachments (slow - saves to disk)
    const attachments = await this.processAttachments(
      parsed.attachments || [],
      account.id,
      messageId
    );
    
    // Build unified message
    const unified: UnifiedMessage = {
      id: messageId,
      accountId: account.id,
      clientId: account.clientId,
      providerMessageId: parsed.messageId,
      
      // Threading
      inReplyTo: parsed.inReplyTo || undefined,
      references: this.parseReferences(parsed.references),
      threadId: this.generateThreadId(parsed),
      
      // Envelope
      from: this.parseEmailAddress(parsed.from),
      to: this.parseEmailAddresses(parsed.to),
      cc: parsed.cc ? this.parseEmailAddresses(parsed.cc) : undefined,
      replyTo: parsed.replyTo ? this.parseEmailAddress(parsed.replyTo) : undefined,
      
      subject: parsed.subject || '(No Subject)',
      
      // Body
      bodyText: parsed.text || undefined,
      bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
      
      // Metadata
      date: (parsed.date || new Date()).toISOString(),
      receivedAt: new Date().toISOString(),
      isRead: false, // We're fetching unseen messages
      isOutgoing: false,
      status: 'new',
      
      // Attachments
      hasAttachments: attachments.length > 0,
      attachments: attachments.length > 0 ? attachments : undefined,
      
      // Sync
      syncedAt: new Date().toISOString(),
      providerUid: msg.uid.toString(),
    };
    
    return unified;
  }
  
  // =========================================================================
  // Process Attachments
  // =========================================================================
  
  private async processAttachments(
    attachments: ParsedAttachment[],
    accountId: string,
    messageId: string
  ): Promise<AttachmentInfo[]> {
    const processedAttachments: AttachmentInfo[] = [];
    
    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      
      try {
        // Save attachment to filesystem
        const saved = await attachmentService.saveAttachment(
          accountId,
          messageId,
          attachment.filename || `attachment_${i}`,
          attachment.content,
          attachment.contentType
        );
        
        processedAttachments.push({
          id: saved.id,
          messageId,
          filename: attachment.filename || `attachment_${i}`,
          mimeType: attachment.contentType,
          size: attachment.size,
          contentId: attachment.contentId || undefined,
          isInline: attachment.contentDisposition === 'inline',
          storagePath: saved.storagePath,
        });
      } catch (error) {
        console.error(`Failed to save attachment ${attachment.filename}:`, error);
        // Continue with other attachments
      }
    }
    
    return processedAttachments;
  }
  
  // =========================================================================
  // Send Message
  // =========================================================================
  
  async sendMessage(
    account: ConnectedAccount, 
    options: SendOptions
  ): Promise<SendResult> {
    const transport = this.createSmtpTransport(account);
    
    try {
      // Build email message
      const mailOptions: Mail.Options = {
        from: account.displayName 
          ? `"${account.displayName}" <${account.emailAddress}>`
          : account.emailAddress,
        to: options.to.map(addr => 
          addr.name ? `"${addr.name}" <${addr.address}>` : addr.address
        ).join(', '),
        subject: options.subject,
      };
      
      // Add CC
      if (options.cc && options.cc.length > 0) {
        mailOptions.cc = options.cc.map(addr => 
          addr.name ? `"${addr.name}" <${addr.address}>` : addr.address
        ).join(', ');
      }
      
      // Add BCC
      if (options.bcc && options.bcc.length > 0) {
        mailOptions.bcc = options.bcc.map(addr => 
          addr.name ? `"${addr.name}" <${addr.address}>` : addr.address
        ).join(', ');
      }
      
      // Add Reply-To
      if (options.replyTo) {
        mailOptions.replyTo = options.replyTo.name
          ? `"${options.replyTo.name}" <${options.replyTo.address}>`
          : options.replyTo.address;
      }
      
      // Add body
      if (options.bodyHtml) {
        mailOptions.html = options.bodyHtml;
      }
      if (options.bodyText) {
        mailOptions.text = options.bodyText;
      }
      
      // Add threading headers
      if (options.inReplyTo) {
        mailOptions.inReplyTo = options.inReplyTo;
      }
      if (options.references && options.references.length > 0) {
        mailOptions.references = options.references.join(' ');
      }
      
      // Add attachments
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          cid: att.contentId,
        }));
      }
      
      // Send the email
      const result = await transport.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: result.messageId,
      };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('SMTP send failed:', error);
      
      return {
        success: false,
        error: `Failed to send email: ${message}`,
      };
    } finally {
      transport.close();
    }
  }
  
  // =========================================================================
  // Helper Methods
  // =========================================================================
  
  private parseEmailAddress(
    addr: ParsedMail['from'] | ParsedMail['replyTo']
  ): EmailAddress {
    if (!addr) {
      return { address: 'unknown@unknown.com' };
    }
    
    const value = addr.value[0];
    return {
      address: value?.address || 'unknown@unknown.com',
      name: value?.name || undefined,
    };
  }
  
  private parseEmailAddresses(
    addrs: ParsedMail['to'] | ParsedMail['cc']
  ): EmailAddress[] {
    if (!addrs) return [];
    
    const values = Array.isArray(addrs) ? addrs : [addrs];
    const result: EmailAddress[] = [];
    
    for (const addr of values) {
      if (addr.value) {
        for (const v of addr.value) {
          result.push({
            address: v.address || 'unknown@unknown.com',
            name: v.name || undefined,
          });
        }
      }
    }
    
    return result;
  }
  
  private parseReferences(refs: ParsedMail['references']): string[] | undefined {
    if (!refs) return undefined;
    
    if (typeof refs === 'string') {
      return refs.split(/\s+/).filter(Boolean);
    }
    
    if (Array.isArray(refs)) {
      return refs;
    }
    
    return undefined;
  }
  
  private generateThreadId(parsed: ParsedMail): string {
    // Use References chain or In-Reply-To to identify thread
    // The first message ID in the chain is typically the thread root
    if (parsed.references) {
      const refs = this.parseReferences(parsed.references);
      if (refs && refs.length > 0) {
        return refs[0]; // First reference is usually the thread root
      }
    }
    
    if (parsed.inReplyTo) {
      return parsed.inReplyTo;
    }
    
    // For new threads, use the message's own ID
    return parsed.messageId || uuid();
  }
}

// Export singleton instance
export const imapProvider = new ImapProvider();

