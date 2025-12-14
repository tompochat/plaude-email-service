// ============================================================================
// Migration Script: Assign existing messages to conversations
// ============================================================================
// Run with: npx ts-node --project tsconfig.json src/scripts/migrate-conversations.ts
// Or with: npm run migrate:conversations (after adding the script to package.json)

import { getStorage } from '../lib/storage';
import { conversationService } from '../lib/services/conversation.service';
import { UnifiedMessage } from '../types';

async function migrateConversations() {
  console.log('🔄 Starting conversation migration...\n');
  
  const storage = getStorage();
  
  // Get all messages
  const messages = await storage.getMessages({ limit: 10000 });
  
  console.log(`📧 Found ${messages.length} messages to process\n`);
  
  if (messages.length === 0) {
    console.log('✅ No messages to migrate!');
    return;
  }
  
  // Sort by date (oldest first) to build conversations chronologically
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let conversationsCreated = 0;
  
  for (const message of sortedMessages) {
    try {
      // Skip if already has a conversation
      if (message.conversationId) {
        skipped++;
        continue;
      }
      
      // Find or create conversation
      const conversation = await conversationService.findOrCreateConversation(message);
      
      // Check if this is a new conversation or existing
      const existingMessages = await storage.getConversationMessages(conversation.id);
      const isNewConversation = existingMessages.length === 0;
      
      if (isNewConversation) {
        conversationsCreated++;
      }
      
      // Update message with conversation ID
      await storage.updateMessage(message.id, { 
        conversationId: conversation.id 
      });
      
      // Update conversation stats if not the first message
      if (!isNewConversation) {
        await conversationService.addMessageToConversation(conversation.id, message);
      }
      
      processed++;
      
      if (processed % 50 === 0) {
        console.log(`   Processed ${processed}/${sortedMessages.length - skipped} messages...`);
      }
    } catch (error) {
      console.error(`❌ Error processing message ${message.id}:`, error);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  console.log(`   Total messages:        ${messages.length}`);
  console.log(`   Already migrated:      ${skipped}`);
  console.log(`   Newly processed:       ${processed}`);
  console.log(`   Errors:                ${errors}`);
  console.log(`   Conversations created: ${conversationsCreated}`);
  console.log('='.repeat(50));
  console.log('\n✅ Migration complete!');
}

// Run the migration
migrateConversations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
