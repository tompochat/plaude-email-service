// ============================================================================
// Sync API Routes
// ============================================================================
// POST /api/sync - Trigger email sync (single account or all)

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKeyOrCron } from '@/lib/middleware/auth';
import { syncService } from '@/lib/services/sync.service';
import { syncRequestSchema } from '@/lib/utils/validation';
import { ApiResponse, SyncResponse } from '@/types';

// ============================================================================
// POST /api/sync
// ============================================================================

export async function POST(request: NextRequest) {
  // Validate API key or cron secret
  const authError = validateApiKeyOrCron(request);
  if (authError) return authError;
  
  try {
    // Parse request body (may be empty for "sync all")
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is OK - means sync all accounts
    }
    
    const validated = syncRequestSchema.parse(body);
    
    let response: SyncResponse;
    
    if (validated.accountId) {
      // Sync single account
      const result = await syncService.syncAccount(
        validated.accountId, 
        validated.maxMessages
      );
      
      response = {
        results: [result],
        summary: {
          total: 1,
          successful: result.success ? 1 : 0,
          failed: result.success ? 0 : 1,
          newMessages: result.newMessages,
        },
      };
    } else {
      // Sync all accounts
      response = await syncService.syncAll();
    }
    
    return NextResponse.json<ApiResponse<SyncResponse>>({
      success: true,
      data: response,
    });
    
  } catch (error) {
    console.error('Error syncing:', error);
    
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
        error: error instanceof Error ? error.message : 'Sync failed' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/sync (for cron jobs)
// ============================================================================
// Vercel Cron jobs use GET requests

export async function GET(request: NextRequest) {
  // Validate cron secret
  const authError = validateApiKeyOrCron(request);
  if (authError) return authError;
  
  try {
    // Sync all accounts
    const response = await syncService.syncAll();
    
    return NextResponse.json<ApiResponse<SyncResponse>>({
      success: true,
      data: response,
    });
    
  } catch (error) {
    console.error('Error in cron sync:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      },
      { status: 500 }
    );
  }
}

