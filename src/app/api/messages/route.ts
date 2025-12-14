// ============================================================================
// Messages API Routes
// ============================================================================
// GET /api/messages - List messages with filters

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { messageService } from '@/lib/services/message.service';
import { messageFiltersSchema } from '@/lib/utils/validation';
import { ApiResponse, UnifiedMessage } from '@/types';

// ============================================================================
// GET /api/messages
// ============================================================================

export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = messageFiltersSchema.parse(searchParams);
    
    // Get messages
    const messages = await messageService.getMessages(filters);
    
    // Get total count for pagination
    const total = await messageService.countMessages({
      ...filters,
      limit: undefined,
      offset: undefined,
    });
    
    return NextResponse.json<ApiResponse<{
      messages: UnifiedMessage[];
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>>({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          hasMore: (filters.offset || 0) + messages.length < total,
        },
      },
    });
    
  } catch (error) {
    console.error('Error listing messages:', error);
    
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
        error: error instanceof Error ? error.message : 'Failed to list messages' 
      },
      { status: 500 }
    );
  }
}

