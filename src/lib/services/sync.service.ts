// ============================================================================
// Sync Service
// ============================================================================
// Orchestrates email synchronization for accounts.
// Fetches new messages and updates sync state.

import { getStorage } from '@/lib/storage';
import { getProvider } from '@/lib/providers';
import { accountService } from './account.service';
import { 
  UnifiedMessage, 
  SyncResult, 
  SyncResponse,
  ConnectedAccount 
} from '@/types';

// ============================================================================
// Sync Service Class
// ============================================================================

class SyncService {
  private storage = getStorage();
  
  // =========================================================================
  // Sync All Accounts
  // =========================================================================
  
  /**
   * Sync all active accounts
   * @returns Sync results for each account
   */
  async syncAll(): Promise<SyncResponse> {
    const accounts = await this.storage.getAccounts();
    const results: SyncResult[] = [];
    
    for (const account of accounts) {
      // Skip inactive accounts
      if (account.status !== 'active') {
        results.push({
          accountId: account.id,
          success: false,
          newMessages: 0,
          error: `Account is ${account.status}`,
        });
        continue;
      }
      
      const result = await this.syncAccount(account.id);
      results.push(result);
    }
    
    return {
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        newMessages: results.reduce((sum, r) => sum + r.newMessages, 0),
      },
    };
  }
  
  // =========================================================================
  // Sync Single Account
  // =========================================================================
  
  /**
   * Sync a specific account
   * @param accountId Account ID to sync
   * @param maxMessages Maximum messages to fetch (default: 50)
   */
  async syncAccount(accountId: string, maxMessages = 5): Promise<SyncResult> {
    try {
      // Get account with credentials
      const account = await accountService.getAccountWithCredentials(accountId);
      
      if (!account) {
        return {
          accountId,
          success: false,
          newMessages: 0,
          error: 'Account not found',
        };
      }
      
      if (account.status !== 'active') {
        return {
          accountId,
          success: false,
          newMessages: 0,
          error: `Account is ${account.status}`,
        };
      }
      
      // Get provider
      const provider = getProvider(account.provider);
      
      // Get sync state
      const syncState = await this.storage.getSyncState(accountId);
      
      // Use account creation date as the starting point for fetching emails
      // This prevents fetching hundreds of old unread emails
      const accountCreatedAt = account.createdAt ? new Date(account.createdAt) : undefined;
      
      console.log(`[Sync] Syncing account ${account.emailAddress}, created at: ${accountCreatedAt?.toISOString()}`);
      
      // Fetch messages
      const result = await provider.fetchMessages(account, {
        syncState: syncState || undefined,
        maxResults: maxMessages,
        markAsRead: true,
        accountCreatedAt, // Only fetch emails received after account was created
      });
      
      // Filter out duplicates (messages we already have)
      const newMessages: UnifiedMessage[] = [];
      
      for (const message of result.messages) {
        const existing = await this.storage.getMessageByProviderId(
          accountId, 
          message.providerMessageId
        );
        
        if (!existing) {
          newMessages.push(message);
        }
      }
      
      // Save new messages
      if (newMessages.length > 0) {
        await this.storage.saveMessages(newMessages);
      }
      
      // Update sync state
      await this.storage.saveSyncState({
        accountId,
        ...result.newSyncState,
      });
      
      // Update account last sync time
      await accountService.updateLastSync(accountId);
      
      // Clear any previous error
      if (account.lastError) {
        await accountService.updateAccountStatus(accountId, 'active');
      }
      
      return {
        accountId,
        success: true,
        newMessages: newMessages.length,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Sync failed for account ${accountId}:`, error);
      
      // Update account status
      try {
        await accountService.updateAccountStatus(accountId, 'error', errorMessage);
      } catch (updateError) {
        console.error('Failed to update account status:', updateError);
      }
      
      return {
        accountId,
        success: false,
        newMessages: 0,
        error: errorMessage,
      };
    }
  }
  
  // =========================================================================
  // Sync Accounts by Client
  // =========================================================================
  
  /**
   * Sync all accounts for a specific client
   * @param clientId Client ID
   */
  async syncByClient(clientId: string): Promise<SyncResponse> {
    const accounts = await this.storage.getAccounts(clientId);
    const results: SyncResult[] = [];
    
    for (const account of accounts) {
      if (account.status !== 'active') {
        results.push({
          accountId: account.id,
          success: false,
          newMessages: 0,
          error: `Account is ${account.status}`,
        });
        continue;
      }
      
      const result = await this.syncAccount(account.id);
      results.push(result);
    }
    
    return {
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        newMessages: results.reduce((sum, r) => sum + r.newMessages, 0),
      },
    };
  }
  
  // =========================================================================
  // Reset Sync State
  // =========================================================================
  
  /**
   * Reset sync state for an account (useful for re-syncing from scratch)
   * @param accountId Account ID
   */
  async resetSyncState(accountId: string): Promise<void> {
    await this.storage.saveSyncState({
      accountId,
      lastUid: undefined,
      lastSyncAt: undefined,
    });
  }
}

// Export singleton instance
export const syncService = new SyncService();

