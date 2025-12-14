// ============================================================================
// Attachment Download API Route
// ============================================================================
// GET /api/attachments/:attachmentId - Download an attachment

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/middleware/auth';
import { getStorage } from '@/lib/storage';
import { attachmentService } from '@/lib/services/attachment.service';
import { ApiResponse } from '@/types';

// ============================================================================
// GET /api/attachments/:attachmentId
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;
  
  try {
    const { attachmentId } = await params;
    const storage = getStorage();
    
    // Get attachment metadata
    const attachment = await storage.getAttachment(attachmentId);
    
    if (!attachment) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Attachment not found' },
        { status: 404 }
      );
    }
    
    // Get attachment content
    const content = await attachmentService.getAttachment(attachment.storagePath);
    
    // Return file with appropriate headers
    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
        'Content-Length': content.length.toString(),
      },
    });
    
  } catch (error) {
    console.error('Error downloading attachment:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to download attachment';
    
    // Check if file not found
    if (errorMessage.includes('not found')) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Attachment file not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json<ApiResponse>(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

