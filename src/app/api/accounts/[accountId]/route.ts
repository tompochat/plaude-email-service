// ============================================================================
// Single Account API Routes
// ============================================================================
// GET    /api/accounts/:accountId - Get account details
// PATCH  /api/accounts/:accountId - Update account
// DELETE /api/accounts/:accountId - Delete account

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { accountService } from '@/lib/services/account.service';
import { updateAccountSchema } from '@/lib/utils/validation';
import { ApiResponse, ConnectedAccount } from '@/types';

// ============================================================================
// GET /api/accounts/:accountId
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { accountId } = await params;
    
    // Get account (without sensitive fields)
    const account = await accountService.getAccountForResponse(accountId);
    
    if (!account) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json<ApiResponse<Partial<ConnectedAccount>>>({
      success: true,
      data: account,
    });
    
  } catch (error) {
    console.error('Error getting account:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get account' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/accounts/:accountId
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { accountId } = await params;
    const body = await request.json();
    
    // Validate update data
    const validated = updateAccountSchema.parse(body);
    
    // Check account exists
    const existing = await accountService.getAccount(accountId);
    if (!existing) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }
    
    // Update account
    const result = await accountService.updateAccount(accountId, validated);
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json<ApiResponse<Partial<ConnectedAccount>>>({
      success: true,
      data: result.data,
    });
    
  } catch (error) {
    console.error('Error updating account:', error);
    
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
        error: error instanceof Error ? error.message : 'Failed to update account' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/accounts/:accountId
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { accountId } = await params;
    
    // Delete account
    const result = await accountService.deleteAccount(accountId);
    
    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: result.error },
        { status: 404 }
      );
    }
    
    return NextResponse.json<ApiResponse>({
      success: true,
    });
    
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete account' 
      },
      { status: 500 }
    );
  }
}

