// ============================================================================
// Client-side API Functions
// ============================================================================
// This module provides type-safe API calls for the UI components.
// All API calls include the x-api-key header for authentication.

// ============================================================================
// Types
// ============================================================================

export interface Account {
  id: string;
  clientId: string;
  provider: string;
  emailAddress: string;
  displayName?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  status: 'active' | 'error' | 'disconnected' | 'pending';
  lastError?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface UpdateAccountRequest {
  displayName?: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string;
  useTls?: boolean;
}

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface AttachmentInfo {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  isInline: boolean;
}

export interface Message {
  id: string;
  accountId: string;
  clientId: string;
  providerMessageId: string;
  threadId?: string;
  inReplyTo?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  date: string;
  receivedAt: string;
  isRead: boolean;
  isOutgoing: boolean;
  status: 'new' | 'read' | 'replied' | 'archived';
  hasAttachments: boolean;
  attachments?: AttachmentInfo[];
  syncedAt: string;
}

export interface SendMessageRequest {
  accountId: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string;
}

export interface MessageFilters {
  accountId?: string;
  clientId?: string;
  since?: string;
  until?: string;
  threadId?: string;
  isRead?: boolean;
  isOutgoing?: boolean;
  hasAttachments?: boolean;
  limit?: number;
  offset?: number;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
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
// API Fetch Helper
// ============================================================================

async function fetchAPI<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || '';
  
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...options.headers,
    },
  });
  
  const data = await res.json();
  
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data.data;
}

// ============================================================================
// Accounts API
// ============================================================================

export const accountsApi = {
  list: (clientId?: string): Promise<Account[]> => 
    fetchAPI<Account[]>(`/accounts${clientId ? `?clientId=${clientId}` : ''}`),
  
  get: (id: string): Promise<Account> => 
    fetchAPI<Account>(`/accounts/${id}`),
  
  create: (data: CreateAccountRequest): Promise<Account> => 
    fetchAPI<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: UpdateAccountRequest): Promise<Account> => 
    fetchAPI<Account>(`/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string): Promise<void> => 
    fetchAPI<void>(`/accounts/${id}`, { method: 'DELETE' }),
};

// ============================================================================
// Messages API
// ============================================================================

export const messagesApi = {
  list: (filters: MessageFilters = {}): Promise<{ messages: Message[]; pagination: Pagination }> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    return fetchAPI<{ messages: Message[]; pagination: Pagination }>(
      `/messages?${params}`
    );
  },
  
  get: (id: string): Promise<Message> => 
    fetchAPI<Message>(`/messages/${id}`),
  
  markAsRead: (id: string): Promise<Message> => 
    fetchAPI<Message>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    }),
  
  markAsUnread: (id: string): Promise<Message> => 
    fetchAPI<Message>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: false }),
    }),
  
  archive: (id: string): Promise<Message> => 
    fetchAPI<Message>(`/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    }),
  
  delete: (id: string): Promise<void> => 
    fetchAPI<void>(`/messages/${id}`, { method: 'DELETE' }),
  
  send: (data: SendMessageRequest): Promise<{ messageId?: string; sentMessageId?: string }> => 
    fetchAPI<{ messageId?: string; sentMessageId?: string }>('/messages/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================================================
// Sync API
// ============================================================================

export const syncApi = {
  syncAll: (): Promise<SyncResponse> => 
    fetchAPI<SyncResponse>('/sync', { method: 'POST' }),
  
  syncAccount: (accountId: string, maxMessages?: number): Promise<SyncResponse> => 
    fetchAPI<SyncResponse>('/sync', {
      method: 'POST',
      body: JSON.stringify({ accountId, maxMessages }),
    }),
};
