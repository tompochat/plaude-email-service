// ============================================================================
// Account Service
// ============================================================================
// Handles CRUD operations for connected email accounts.
// Manages credential encryption and connection testing.

import { v4 as uuid } from 'uuid';
import { getStorage } from '@/lib/storage';
import { getProvider } from '@/lib/providers';
import { 
  encryptAccountSecrets, 
  decryptAccountSecrets,
  sanitizeAccountForResponse 
} from '@/lib/utils/crypto';
import { ConnectedAccount, CreateAccountRequest, ApiResponse } from '@/types';

// ============================================================================
// Account Service Class
// ============================================================================

class AccountService {
  private storage = getStorage();
  
  // =========================================================================
  // List Accounts
  // =========================================================================
  
  /**
   * List all accounts, optionally filtered by clientId
   * @param clientId Optional client ID to filter by
   * @returns Accounts with sensitive fields removed
   */
  async listAccounts(clientId?: string): Promise<Partial<ConnectedAccount>[]> {
    const accounts = await this.storage.getAccounts(clientId);
    
    // Decrypt for any internal processing, then sanitize for response
    return accounts.map(account => {
      const copy = { ...account };
      // Don't decrypt - just remove sensitive fields for response
      return sanitizeAccountForResponse(copy);
    });
  }
  
  // =========================================================================
  // Get Single Account
  // =========================================================================
  
  /**
   * Get a single account by ID
   * @param id Account ID
   * @param includeSecrets If true, decrypt and return secrets (for internal use)
   * @returns Account or null
   */
  async getAccount(id: string, includeSecrets = false): Promise<ConnectedAccount | null> {
    const account = await this.storage.getAccount(id);
    
    if (!account) {
      return null;
    }
    
    if (includeSecrets) {
      // Decrypt sensitive fields for internal use (e.g., sending emails)
      decryptAccountSecrets(account as unknown as Record<string, unknown>);
    }
    
    return account;
  }
  
  /**
   * Get account with decrypted credentials (for providers)
   */
  async getAccountWithCredentials(id: string): Promise<ConnectedAccount | null> {
    return this.getAccount(id, true);
  }
  
  /**
   * Get account for API response (without secrets)
   */
  async getAccountForResponse(id: string): Promise<Partial<ConnectedAccount> | null> {
    const account = await this.getAccount(id, false);
    if (!account) return null;
    return sanitizeAccountForResponse(account as unknown as Record<string, unknown>);
  }
  
  // =========================================================================
  // Create Account
  // =========================================================================
  
  /**
   * Create a new IMAP account
   * @param request Account creation request
   * @returns Created account (sanitized) or error
   */
  async createAccount(request: CreateAccountRequest): Promise<ApiResponse<Partial<ConnectedAccount>>> {
    // Check if account with same email already exists for this client
    const existingAccounts = await this.storage.getAccountsByClient(request.clientId);
    const duplicate = existingAccounts.find(a => 
      a.emailAddress.toLowerCase() === request.emailAddress.toLowerCase()
    );
    
    if (duplicate) {
      return {
        success: false,
        error: `Account with email ${request.emailAddress} already exists for this client`,
      };
    }
    
    // Build account object
    const account: ConnectedAccount = {
      id: uuid(),
      clientId: request.clientId,
      provider: 'imap',
      emailAddress: request.emailAddress,
      displayName: request.displayName,
      imapHost: request.imapHost,
      imapPort: request.imapPort,
      smtpHost: request.smtpHost,
      smtpPort: request.smtpPort,
      username: request.username,
      password: request.password,
      useTls: request.useTls ?? true,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Test connection before saving
    try {
      const provider = getProvider('imap');
      const connected = await provider.testConnection(account);
      
      if (!connected) {
        return {
          success: false,
          error: 'Failed to connect with provided credentials. Please verify your IMAP settings.',
        };
      }
      
      account.status = 'active';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Connection test failed: ${message}`,
      };
    }
    
    // Encrypt sensitive fields before storing
    const accountToStore = { ...account };
    encryptAccountSecrets(accountToStore as unknown as Record<string, unknown>);
    
    await this.storage.saveAccount(accountToStore);
    
    // Return sanitized account
    return {
      success: true,
      data: sanitizeAccountForResponse(account as unknown as Record<string, unknown>),
    };
  }
  
  // =========================================================================
  // Update Account
  // =========================================================================
  
  /**
   * Update account fields
   * @param id Account ID
   * @param updates Fields to update
   */
  async updateAccount(
    id: string, 
    updates: Partial<ConnectedAccount>
  ): Promise<ApiResponse<Partial<ConnectedAccount>>> {
    const account = await this.storage.getAccount(id);
    
    if (!account) {
      return {
        success: false,
        error: 'Account not found',
      };
    }
    
    // Decrypt existing secrets
    decryptAccountSecrets(account as unknown as Record<string, unknown>);
    
    // Apply updates
    const updatedAccount: ConnectedAccount = {
      ...account,
      ...updates,
      id: account.id,           // Prevent ID change
      clientId: account.clientId, // Prevent client change
      provider: account.provider, // Prevent provider change
      updatedAt: new Date().toISOString(),
    };
    
    // If credentials changed, test connection
    const credentialsChanged = (
      updates.imapHost !== undefined ||
      updates.imapPort !== undefined ||
      updates.username !== undefined ||
      updates.password !== undefined
    );
    
    if (credentialsChanged) {
      try {
        const provider = getProvider('imap');
        const connected = await provider.testConnection(updatedAccount);
        
        if (!connected) {
          return {
            success: false,
            error: 'Failed to connect with new credentials',
          };
        }
        
        updatedAccount.status = 'active';
        updatedAccount.lastError = undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: `Connection test failed: ${message}`,
        };
      }
    }
    
    // Encrypt and save
    const accountToStore = { ...updatedAccount };
    encryptAccountSecrets(accountToStore as unknown as Record<string, unknown>);
    await this.storage.saveAccount(accountToStore);
    
    return {
      success: true,
      data: sanitizeAccountForResponse(updatedAccount as unknown as Record<string, unknown>),
    };
  }
  
  // =========================================================================
  // Update Account Status
  // =========================================================================
  
  /**
   * Update account status (internal use)
   */
  async updateAccountStatus(
    id: string, 
    status: ConnectedAccount['status'], 
    error?: string
  ): Promise<void> {
    const account = await this.storage.getAccount(id);
    
    if (!account) {
      throw new Error('Account not found');
    }
    
    account.status = status;
    account.lastError = error;
    account.updatedAt = new Date().toISOString();
    
    await this.storage.saveAccount(account);
  }
  
  /**
   * Update last sync time
   */
  async updateLastSync(id: string): Promise<void> {
    const account = await this.storage.getAccount(id);
    
    if (!account) {
      throw new Error('Account not found');
    }
    
    account.lastSyncAt = new Date().toISOString();
    account.updatedAt = new Date().toISOString();
    
    await this.storage.saveAccount(account);
  }
  
  // =========================================================================
  // Delete Account
  // =========================================================================
  
  /**
   * Delete an account
   * @param id Account ID
   */
  async deleteAccount(id: string): Promise<ApiResponse<void>> {
    const account = await this.storage.getAccount(id);
    
    if (!account) {
      return {
        success: false,
        error: 'Account not found',
      };
    }
    
    await this.storage.deleteAccount(id);
    
    // Note: Messages and attachments are not deleted automatically
    // This is intentional - you may want to keep history
    // Add cleanup logic here if needed
    
    return {
      success: true,
    };
  }
  
  // =========================================================================
  // Verify Account Ownership
  // =========================================================================
  
  /**
   * Verify that an account belongs to a specific client
   */
  async verifyOwnership(accountId: string, clientId: string): Promise<boolean> {
    const account = await this.storage.getAccount(accountId);
    return account !== null && account.clientId === clientId;
  }
}

// Export singleton instance
export const accountService = new AccountService();

