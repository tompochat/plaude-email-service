// ============================================================================
// Account API Routes
// ============================================================================
// GET  /api/accounts - List accounts (optional ?clientId filter)
// POST /api/accounts - Create new IMAP account

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { accountService } from '@/lib/services/account.service';
import { createAccountSchema, accountFiltersSchema } from '@/lib/utils/validation';
import { ApiResponse, ConnectedAccount } from '@/types';

// ============================================================================
// GET /api/accounts
// ============================================================================

export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = accountFiltersSchema.parse(searchParams);
    
    // Get accounts
    const accounts = await accountService.listAccounts(filters.clientId);
    
    return NextResponse.json<ApiResponse<Partial<ConnectedAccount>[]>>({
      success: true,
      data: accounts,
    });
    
  } catch (error) {
    console.error('Error listing accounts:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list accounts' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/accounts
// ============================================================================

export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = createAccountSchema.parse(body);
    
    // Create account
    const result = await accountService.createAccount(validated);
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse<Partial<ConnectedAccount>>>(
      { success: true, data: result.data },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Error creating account:', error);
    
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
        error: error instanceof Error ? error.message : 'Failed to create account' 
      },
      { status: 500 }
    );
  }
}

