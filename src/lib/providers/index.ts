// ============================================================================
// Provider Factory
// ============================================================================
// Creates and returns the appropriate email provider based on type.
// Phase 1: Only IMAP provider
// Phase 2: Add Gmail and Microsoft providers

import { EmailProvider } from './types';
import { imapProvider } from './imap.provider';
import { EmailProviderType } from '@/types';

// Provider registry
const providers: Record<string, EmailProvider> = {
  imap: imapProvider,
  // Phase 2: Add OAuth providers
  // gmail: gmailProvider,
  // microsoft: microsoftProvider,
};

/**
 * Get a provider instance by type
 * @param type The provider type ('imap', 'gmail', 'microsoft')
 * @returns The provider instance
 * @throws Error if provider type is not supported
 */
export function getProvider(type: EmailProviderType): EmailProvider {
  const provider = providers[type];
  
  if (!provider) {
    throw new Error(`Unsupported email provider type: ${type}. Supported types: ${Object.keys(providers).join(', ')}`);
  }
  
  return provider;
}

/**
 * Check if a provider type is supported
 * @param type The provider type to check
 * @returns true if the provider is available
 */
export function isProviderSupported(type: string): type is EmailProviderType {
  return type in providers;
}

/**
 * Get list of supported provider types
 * @returns Array of supported provider type names
 */
export function getSupportedProviders(): EmailProviderType[] {
  return Object.keys(providers) as EmailProviderType[];
}

// Re-export types and providers
export * from './types';
export { imapProvider };

