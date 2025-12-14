// ============================================================================
// API Authentication Middleware
// ============================================================================
// Validates API key for all protected endpoints

import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';

/**
 * Validate API key from request headers
 * @param request The Next.js request object
 * @returns null if valid, NextResponse with error if invalid
 */
export function validateApiKey(request: NextRequest): NextResponse<ApiResponse> | null {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SERVICE_API_KEY;
  
  // Check if API key is configured
  if (!expectedKey) {
    console.error('SERVICE_API_KEY environment variable is not set');
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: 'Service misconfigured: API key not set' 
      },
      { status: 500 }
    );
  }
  
  // Check if API key is provided
  if (!apiKey) {
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: 'Missing API key. Include x-api-key header.' 
      },
      { status: 401 }
    );
  }
  
  // Validate API key
  if (apiKey !== expectedKey) {
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: 'Invalid API key' 
      },
      { status: 401 }
    );
  }
  
  // Valid
  return null;
}

/**
 * Validate cron secret for scheduled jobs
 * This is useful for Vercel Cron or external cron services
 * @param request The Next.js request object
 * @returns null if valid, NextResponse with error if invalid
 */
export function validateCronSecret(request: NextRequest): NextResponse<ApiResponse> | null {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is not set, skip validation (for local development)
  if (!cronSecret) {
    return null;
  }
  
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json<ApiResponse>(
      { 
        success: false, 
        error: 'Unauthorized cron request' 
      },
      { status: 401 }
    );
  }
  
  return null;
}

/**
 * Combined auth check: accepts either API key or cron secret
 * Useful for sync endpoints that can be triggered manually or by cron
 */
export function validateApiKeyOrCron(request: NextRequest): NextResponse<ApiResponse> | null {
  // Try API key first
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.SERVICE_API_KEY;
  
  if (apiKey && expectedApiKey && apiKey === expectedApiKey) {
    return null; // Valid API key
  }
  
  // Try cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return null; // Valid cron secret
  }
  
  // Neither valid
  return NextResponse.json<ApiResponse>(
    { 
      success: false, 
      error: 'Invalid or missing authentication' 
    },
    { status: 401 }
  );
}

