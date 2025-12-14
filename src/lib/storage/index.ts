// ============================================================================
// Storage Factory
// ============================================================================
// Creates and returns the appropriate storage adapter based on configuration.
// For Phase 1, always returns JsonStorage.
// Phase 2: Can be extended to return PostgresStorage based on env vars.

import { StorageAdapter } from './types';
import { JsonStorage } from './json.storage';

// Singleton instance
let storageInstance: StorageAdapter | null = null;

/**
 * Get the storage adapter instance (singleton pattern)
 * 
 * In Phase 2, this can be extended to check environment variables
 * and return different storage implementations:
 * 
 * ```typescript
 * export function getStorage(): StorageAdapter {
 *   if (!storageInstance) {
 *     const storageType = process.env.STORAGE_TYPE || 'json';
 *     
 *     switch (storageType) {
 *       case 'postgres':
 *         storageInstance = new PostgresStorage();
 *         break;
 *       case 'json':
 *       default:
 *         storageInstance = new JsonStorage();
 *     }
 *   }
 *   return storageInstance;
 * }
 * ```
 */
export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    storageInstance = new JsonStorage();
  }
  return storageInstance;
}

/**
 * Reset storage instance (useful for testing)
 */
export function resetStorage(): void {
  storageInstance = null;
}

// Re-export types
export * from './types';

