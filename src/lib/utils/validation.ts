// ============================================================================
// Zod Validation Schemas
// ============================================================================
// Centralized validation schemas for all API inputs

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const emailAddressSchema = z.object({
  address: z.string().email('Invalid email address'),
  name: z.string().optional(),
});

// ============================================================================
// Account Schemas
// ============================================================================

export const createAccountSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  emailAddress: z.string().email('Invalid email address'),
  displayName: z.string().optional(),
  imapHost: z.string().min(1, 'IMAP host is required'),
  imapPort: z.number().int().positive().max(65535),
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.number().int().positive().max(65535),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  useTls: z.boolean().default(true),
});

export const updateAccountSchema = z.object({
  displayName: z.string().optional(),
  imapHost: z.string().min(1).optional(),
  imapPort: z.number().int().positive().max(65535).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().positive().max(65535).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  useTls: z.boolean().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

// ============================================================================
// Message Schemas
// ============================================================================

export const sendAttachmentSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  content: z.string().min(1, 'Content is required'), // Base64 encoded
  contentType: z.string().min(1, 'Content type is required'),
});

export const sendMessageSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  to: z.array(emailAddressSchema).min(1, 'At least one recipient is required'),
  cc: z.array(emailAddressSchema).optional(),
  bcc: z.array(emailAddressSchema).optional(),
  subject: z.string(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  inReplyTo: z.string().optional(), // Message ID to reply to
  attachments: z.array(sendAttachmentSchema).optional(),
}).refine(
  data => data.bodyText || data.bodyHtml,
  { message: 'Either bodyText or bodyHtml must be provided' }
);

// ============================================================================
// Query/Filter Schemas
// ============================================================================

export const messageFiltersSchema = z.object({
  accountId: z.string().optional(),
  clientId: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  threadId: z.string().optional(),
  isRead: z.coerce.boolean().optional(),
  isOutgoing: z.coerce.boolean().optional(),
  hasAttachments: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const accountFiltersSchema = z.object({
  clientId: z.string().optional(),
});

// ============================================================================
// Sync Schemas
// ============================================================================

export const syncRequestSchema = z.object({
  accountId: z.string().optional(), // If omitted, sync all accounts
  maxMessages: z.number().int().positive().max(100).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageFiltersInput = z.infer<typeof messageFiltersSchema>;
export type SyncRequestInput = z.infer<typeof syncRequestSchema>;

