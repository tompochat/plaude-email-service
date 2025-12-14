// ============================================================================
// Attachment Service
// ============================================================================
// Handles storage and retrieval of email attachments on the filesystem.
// Phase 2: Can be extended to use S3/R2 for cloud storage.

import { mkdir, writeFile, readFile, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

// ============================================================================
// Configuration
// ============================================================================

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments');

// ============================================================================
// Types
// ============================================================================

export interface SavedAttachment {
  id: string;
  storagePath: string;
  size: number;
}

// ============================================================================
// Attachment Service
// ============================================================================

class AttachmentService {
  
  /**
   * Ensure the attachments directory structure exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await mkdir(dirPath, { recursive: true });
    }
  }
  
  /**
   * Get the directory path for an account's attachments
   */
  private getAccountDir(accountId: string): string {
    return path.join(ATTACHMENTS_DIR, accountId);
  }
  
  /**
   * Get the directory path for a message's attachments
   */
  private getMessageDir(accountId: string, messageId: string): string {
    return path.join(this.getAccountDir(accountId), messageId);
  }
  
  /**
   * Sanitize filename to prevent directory traversal attacks
   */
  private sanitizeFilename(filename: string): string {
    // Remove any path components and dangerous characters
    return filename
      .replace(/[/\\]/g, '_')     // Replace path separators
      .replace(/\.\./g, '_')      // Replace parent directory references
      .replace(/[<>:"|?*]/g, '_') // Replace invalid filename characters
      .trim();
  }
  
  /**
   * Save an attachment to the filesystem
   * @param accountId The account ID
   * @param messageId The message ID
   * @param filename Original filename
   * @param content Attachment content as Buffer
   * @param contentType MIME type
   * @returns Saved attachment info
   */
  async saveAttachment(
    accountId: string,
    messageId: string,
    filename: string,
    content: Buffer,
    contentType: string
  ): Promise<SavedAttachment> {
    const id = uuid();
    const sanitizedFilename = this.sanitizeFilename(filename);
    const messageDir = this.getMessageDir(accountId, messageId);
    
    await this.ensureDir(messageDir);
    
    // Use ID prefix to avoid filename collisions
    const storedFilename = `${id}_${sanitizedFilename}`;
    const storagePath = path.join(messageDir, storedFilename);
    
    await writeFile(storagePath, content);
    
    return {
      id,
      storagePath,
      size: content.length,
    };
  }
  
  /**
   * Get an attachment by its storage path
   * @param storagePath The storage path from AttachmentInfo
   * @returns Attachment content as Buffer
   * @throws Error if attachment not found
   */
  async getAttachment(storagePath: string): Promise<Buffer> {
    // Validate the path is within our attachments directory
    const normalizedPath = path.normalize(storagePath);
    const normalizedAttachmentsDir = path.normalize(ATTACHMENTS_DIR);
    
    if (!normalizedPath.startsWith(normalizedAttachmentsDir)) {
      throw new Error('Invalid attachment path');
    }
    
    if (!existsSync(storagePath)) {
      throw new Error('Attachment not found');
    }
    
    return readFile(storagePath);
  }
  
  /**
   * Get attachment by ID (searches through all messages)
   * This is a fallback method - prefer using storagePath directly
   */
  async getAttachmentById(attachmentId: string): Promise<{ content: Buffer; storagePath: string } | null> {
    // This would require searching through message metadata
    // For efficiency, attachments should be retrieved via storagePath
    // stored in the message's attachments array
    console.warn('getAttachmentById is inefficient - use storagePath instead');
    return null;
  }
  
  /**
   * Delete an attachment
   * @param storagePath The storage path
   */
  async deleteAttachment(storagePath: string): Promise<void> {
    // Validate the path is within our attachments directory
    const normalizedPath = path.normalize(storagePath);
    const normalizedAttachmentsDir = path.normalize(ATTACHMENTS_DIR);
    
    if (!normalizedPath.startsWith(normalizedAttachmentsDir)) {
      throw new Error('Invalid attachment path');
    }
    
    if (existsSync(storagePath)) {
      await unlink(storagePath);
    }
  }
  
  /**
   * Delete all attachments for a message
   * @param accountId Account ID
   * @param messageId Message ID
   */
  async deleteMessageAttachments(accountId: string, messageId: string): Promise<void> {
    const messageDir = this.getMessageDir(accountId, messageId);
    
    if (existsSync(messageDir)) {
      const { rm } = await import('fs/promises');
      await rm(messageDir, { recursive: true, force: true });
    }
  }
  
  /**
   * Get attachment metadata (size, exists)
   * @param storagePath The storage path
   */
  async getAttachmentInfo(storagePath: string): Promise<{ exists: boolean; size: number } | null> {
    try {
      const stats = await stat(storagePath);
      return {
        exists: true,
        size: stats.size,
      };
    } catch {
      return {
        exists: false,
        size: 0,
      };
    }
  }
  
  /**
   * Save attachment from base64 encoded content (for sending)
   * @param accountId Account ID
   * @param messageId Message ID  
   * @param filename Filename
   * @param base64Content Base64 encoded content
   * @param contentType MIME type
   */
  async saveAttachmentFromBase64(
    accountId: string,
    messageId: string,
    filename: string,
    base64Content: string,
    contentType: string
  ): Promise<SavedAttachment> {
    const content = Buffer.from(base64Content, 'base64');
    return this.saveAttachment(accountId, messageId, filename, content, contentType);
  }
}

// Export singleton instance
export const attachmentService = new AttachmentService();

