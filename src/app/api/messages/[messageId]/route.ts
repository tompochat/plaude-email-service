// ============================================================================
// Single Message API Routes
// ============================================================================
// GET    /api/messages/:messageId - Get message details
// PATCH  /api/messages/:messageId - Update message (mark read, archive)
// DELETE /api/messages/:messageId - Delete message

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { messageService } from '@/lib/services/message.service';
import { ApiResponse, UnifiedMessage } from '@/types';
import { z } from 'zod';

// Update schema
const updateMessageSchema = z.object({
  isRead: z.boolean().optional(),
  status: z.enum(['new', 'read', 'replied', 'archived']).optional(),
});

// ============================================================================
// GET /api/messages/:messageId
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { messageId } = await params;
    
    // Get message
    const message = await messageService.getMessage(messageId);
    
    if (!message) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json<ApiResponse<UnifiedMessage>>({
      success: true,
      data: message,
    });
    
  } catch (error) {
    console.error('Error getting message:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get message' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/messages/:messageId
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { messageId } = await params;
    const body = await request.json();
    const updates = updateMessageSchema.parse(body);
    
    // Check message exists
    const message = await messageService.getMessage(messageId);
    
    if (!message) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }
    
    // Apply updates
    if (updates.isRead !== undefined) {
      if (updates.isRead) {
        await messageService.markAsRead(messageId);
      } else {
        await messageService.markAsUnread(messageId);
      }
    }
    
    if (updates.status === 'archived') {
      await messageService.archiveMessage(messageId);
    }
    
    // Get updated message
    const updated = await messageService.getMessage(messageId);
    
    return NextResponse.json<ApiResponse<UnifiedMessage | null>>({
      success: true,
      data: updated,
    });
    
  } catch (error) {
    console.error('Error updating message:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json<ApiResponse>(
        { 
          success: false, 
          error: 'Validation failed',
          details: error
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update message' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/messages/:messageId
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { messageId } = await params;
    
    // Check message exists
    const message = await messageService.getMessage(messageId);
    
    if (!message) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }
    
    // Delete message
    await messageService.deleteMessage(messageId);
    
    return NextResponse.json<ApiResponse>({
      success: true,
    });
    
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete message' 
      },
      { status: 500 }
    );
  }
}

