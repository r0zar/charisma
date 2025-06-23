import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyById, deleteApiKey, getApiKeyUsageLogs } from '@/lib/api-keys/store';
import { 
  authenticateSignature,
  validateDeleteApiKeyMessage,
  validateWalletAddress,
  createErrorResponse,
  createSuccessResponse
} from '@/lib/api-keys/middleware';
import { 
  DeleteApiKeyRequest,
  DeleteApiKeyResponse,
  ApiKeyErrorCode
} from '@/lib/api-keys/types';

/**
 * GET /api/v1/api-keys/{keyId} - Get API key details and usage stats
 */
export async function GET(
  request: NextRequest, 
  { params }: { params: { keyId: string } }
) {
  try {
    const { keyId } = await params;

    // Get authentication headers
    const message = request.headers.get('x-message');
    const signature = request.headers.get('x-signature');
    const walletAddress = request.headers.get('x-wallet-address');

    if (!message || !signature || !walletAddress) {
      return createErrorResponse(
        'Missing required headers: X-Message, X-Signature, X-Wallet-Address',
        401
      );
    }

    // Validate wallet address format
    if (!validateWalletAddress(walletAddress)) {
      return createErrorResponse('Invalid wallet address format');
    }

    // Get the API key to verify ownership
    const apiKey = await getApiKeyById(keyId);
    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    // Verify wallet owns this key
    if (apiKey.walletAddress !== walletAddress) {
      return createErrorResponse('Unauthorized', 403);
    }

    // Create a mock request for signature verification
    const mockRequest = new Request(request.url, {
      method: 'GET',
      headers: request.headers,
      body: JSON.stringify({
        message,
        signature,
        walletAddress
      })
    });

    // Authenticate signature - use a simple message validation for GET
    const authResult = await authenticateSignature(
      mockRequest as any,
      walletAddress,
      (msg) => msg.action === 'get_api_key_stats' && msg.keyId === keyId
    );

    if (!authResult.success) {
      return createErrorResponse(authResult.error!, 401);
    }

    try {
      // Get usage logs
      const usageLogs = await getApiKeyUsageLogs(keyId, 50);

      // Remove sensitive data (keyHash) from response
      const { keyHash, ...publicKey } = apiKey;

      const response = {
        status: 'success',
        apiKey: publicKey,
        recentActivity: usageLogs
      };

      return createSuccessResponse(response);

    } catch (error) {
      console.error('Failed to get API key stats:', error);
      return createErrorResponse('Failed to retrieve API key statistics', 500);
    }

  } catch (error) {
    console.error('API key stats error:', error);
    return createErrorResponse('Invalid request format', 400);
  }
}

/**
 * DELETE /api/v1/api-keys/{keyId} - Delete/revoke an API key
 */
export async function DELETE(
  request: NextRequest, 
  { params }: { params: { keyId: string } }
) {
  try {
    const { keyId } = await params;
    const body: DeleteApiKeyRequest = await request.json();

    // Validate basic request structure
    if (!body.walletAddress || !body.message || !body.signature) {
      return createErrorResponse('Missing required fields: walletAddress, message, signature');
    }

    // Validate wallet address format
    if (!validateWalletAddress(body.walletAddress)) {
      return createErrorResponse('Invalid wallet address format');
    }

    // Get the API key to verify ownership and existence
    const apiKey = await getApiKeyById(keyId);
    if (!apiKey) {
      return createErrorResponse('API key not found', 404);
    }

    // Verify wallet owns this key
    if (apiKey.walletAddress !== body.walletAddress) {
      return createErrorResponse('Unauthorized', 403);
    }

    // Authenticate signature and validate message
    const authResult = await authenticateSignature(
      request,
      body.walletAddress,
      (msg) => validateDeleteApiKeyMessage(msg) && msg.keyId === keyId
    );

    if (!authResult.success) {
      return createErrorResponse(authResult.error!, 401);
    }

    try {
      // Delete the API key
      const deleted = await deleteApiKey(keyId);

      if (!deleted) {
        return createErrorResponse('Failed to delete API key', 500);
      }

      const response: DeleteApiKeyResponse = {
        status: 'success',
        message: `API key "${apiKey.name}" has been revoked`
      };

      return createSuccessResponse(response);

    } catch (error) {
      console.error('Failed to delete API key:', error);
      return createErrorResponse('Failed to delete API key', 500);
    }

  } catch (error) {
    console.error('API key deletion error:', error);
    return createErrorResponse('Invalid request format', 400);
  }
}