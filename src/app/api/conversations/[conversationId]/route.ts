// ============================================================================
// Single Conversation API Routes
// ============================================================================
// GET    /api/conversations/:id - Get conversation with messages
// PATCH  /api/conversations/:id - Update status (close/reopen)
// DELETE /api/conversations/:id - Delete conversation

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { conversationService } from '@/lib/services/conversation.service';
import { ApiResponse, ConversationWithMessages } from '@/types';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum(['open', 'closed', 'archived']).optional(),
});

// GET - Get conversation with all messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { conversationId } = await params;
    const conversation = await conversationService.getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    // Mark all messages as read when viewing conversation
    await conversationService.markConversationAsRead(conversationId);
    
    return NextResponse.json<ApiResponse<ConversationWithMessages>>({
      success: true,
      data: { ...conversation, unreadCount: 0 },
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to get conversation' },
      { status: 500 }
    );
  }
}

// PATCH - Update conversation status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { conversationId } = await params;
    const body = await request.json();
    const { status } = updateSchema.parse(body);
    
    let result;
    
    if (status === 'closed') {
      result = await conversationService.closeConversation(conversationId);
    } else if (status === 'open') {
      result = await conversationService.reopenConversation(conversationId);
    } else if (status === 'archived') {
      result = await conversationService.archiveConversation(conversationId);
    } else {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 404 }
      );
    }
    
    const updated = await conversationService.getConversation(conversationId);
    
    return NextResponse.json<ApiResponse>({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Validation failed', details: error },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

// DELETE - Delete conversation and all its messages
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { conversationId } = await params;
    
    const result = await conversationService.deleteConversation(conversationId);
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 404 }
      );
    }
    
    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
