// ============================================================================
// Send Message API Route
// ============================================================================
// POST /api/messages/send - Send a new email or reply

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { messageService } from '@/lib/services/message.service';
import { sendMessageSchema } from '@/lib/utils/validation';
import { ApiResponse } from '@/types';

// ============================================================================
// POST /api/messages/send
// ============================================================================

export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = sendMessageSchema.parse(body);
    
    // Send message
    const result = await messageService.sendMessage(validated);
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse<{ 
      messageId?: string; 
      sentMessageId?: string;
    }>>(
      { success: true, data: result.data },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Handle validation errors
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
        error: error instanceof Error ? error.message : 'Failed to send message' 
      },
      { status: 500 }
    );
  }
}

