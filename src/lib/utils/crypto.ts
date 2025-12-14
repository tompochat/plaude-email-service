// ============================================================================
// Encryption Utilities
// ============================================================================
// AES-256-GCM encryption for sensitive data (passwords, tokens).
// The encryption key must be exactly 32 characters.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment
 * @throws Error if key is not set or not 32 characters
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters');
  }
  
  return Buffer.from(key, 'utf-8');
}

/**
 * Encrypt a string using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string that was encrypted with encrypt()
 * @param encryptedText The encrypted string in format: iv:authTag:ciphertext
 * @returns The decrypted plaintext
 * @throws Error if decryption fails
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Check if a string appears to be encrypted (has the expected format)
 */
export function isEncrypted(text: string): boolean {
  const parts = text.split(':');
  if (parts.length !== 3) return false;
  
  const [ivHex, authTagHex] = parts;
  
  // Check if IV and authTag are valid hex of expected length
  return (
    ivHex.length === IV_LENGTH * 2 &&
    authTagHex.length === AUTH_TAG_LENGTH * 2 &&
    /^[0-9a-f]+$/i.test(ivHex) &&
    /^[0-9a-f]+$/i.test(authTagHex)
  );
}

/**
 * Encrypt sensitive fields in an account object
 * Modifies the object in place
 */
export function encryptAccountSecrets(account: Record<string, unknown>): void {
  const sensitiveFields = ['password', 'accessToken', 'refreshToken'];
  
  for (const field of sensitiveFields) {
    const value = account[field];
    if (value && typeof value === 'string' && !isEncrypted(value)) {
      account[field] = encrypt(value);
    }
  }
}

/**
 * Decrypt sensitive fields in an account object
 * Modifies the object in place
 */
export function decryptAccountSecrets(account: Record<string, unknown>): void {
  const sensitiveFields = ['password', 'accessToken', 'refreshToken'];
  
  for (const field of sensitiveFields) {
    const value = account[field];
    if (value && typeof value === 'string' && isEncrypted(value)) {
      try {
        account[field] = decrypt(value);
      } catch (error) {
        // If decryption fails, the value might not be encrypted
        console.warn(`Failed to decrypt ${field}:`, error);
      }
    }
  }
}

/**
 * Remove sensitive fields from an account object for API responses
 * Returns a new object without modifying the original
 */
export function sanitizeAccountForResponse<T extends Record<string, unknown>>(account: T): Partial<T> {
  const sensitiveFields = ['password', 'accessToken', 'refreshToken'];
  const sanitized = { ...account };
  
  for (const field of sensitiveFields) {
    delete sanitized[field];
  }
  
  return sanitized;
}

