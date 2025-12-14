// ============================================================================
// Conversations API Routes
// ============================================================================
// GET /api/conversations - List conversations

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { conversationService } from '@/lib/services/conversation.service';
import { ApiResponse, Conversation } from '@/types';
import { z } from 'zod';

const filtersSchema = z.object({
  accountId: z.string().optional(),
  clientId: z.string().optional(),
  status: z.enum(['open', 'closed', 'archived']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = filtersSchema.parse(searchParams);
    
    const conversations = await conversationService.getConversations(filters);
    const total = await conversationService.countConversations({
      ...filters,
      limit: undefined,
      offset: undefined,
    });
    
    return NextResponse.json<ApiResponse<{
      conversations: Conversation[];
      pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      };
    }>>({
      success: true,
      data: {
        conversations,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + conversations.length < total,
        },
      },
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Validation failed', details: error },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}
