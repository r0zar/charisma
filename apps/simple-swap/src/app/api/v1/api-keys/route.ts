import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, getApiKeysByWallet } from '@/lib/api-keys/store';
import { 
  authenticateSignature,
  validateCreateApiKeyMessage,
  validateListApiKeysMessage,
  validateWalletAddress,
  createErrorResponse,
  createSuccessResponse
} from '@/lib/api-keys/middleware';
import { 
  CreateApiKeyRequest,
  ListApiKeysRequest,
  CreateApiKeyResponse,
  ListApiKeysResponse,
  DEFAULT_RATE_LIMIT,
  ApiKeyErrorCode
} from '@/lib/api-keys/types';

/**
 * POST /api/v1/api-keys - Create a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateApiKeyRequest = await request.json();

    // Validate basic request structure
    if (!body.walletAddress || !body.message || !body.signature) {
      return createErrorResponse('Missing required fields: walletAddress, message, signature');
    }

    // Validate wallet address format
    if (!validateWalletAddress(body.walletAddress)) {
      return createErrorResponse('Invalid wallet address format');
    }

    // Authenticate signature and validate message
    const authResult = await authenticateSignature(
      request,
      body.walletAddress,
      validateCreateApiKeyMessage
    );

    if (!authResult.success) {
      return createErrorResponse(authResult.error!, 401);
    }

    const message = authResult.parsedMessage!;

    try {
      // Create the API key
      const { apiKey, keyRecord } = await createApiKey(
        body.walletAddress,
        message,
        DEFAULT_RATE_LIMIT
      );

      const response: CreateApiKeyResponse = {
        status: 'success',
        apiKey, // Only returned once!
        keyId: keyRecord.id,
        name: keyRecord.name,
        permissions: keyRecord.permissions,
        rateLimit: keyRecord.rateLimit,
        expiresAt: keyRecord.expiresAt
      };

      return createSuccessResponse(response);

    } catch (error) {
      console.error('Failed to create API key:', error);
      
      if (error instanceof Error) {
        if (error.message === ApiKeyErrorCode.DUPLICATE_KEY_NAME) {
          return createErrorResponse(
            'An active API key with this name already exists',
            400,
            { code: ApiKeyErrorCode.DUPLICATE_KEY_NAME }
          );
        }
      }

      return createErrorResponse('Failed to create API key', 500);
    }

  } catch (error) {
    console.error('API key creation error:', error);
    return createErrorResponse('Invalid request format', 400);
  }
}

/**
 * GET /api/v1/api-keys - List API keys for a wallet
 */
export async function GET(request: NextRequest) {
  try {
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

    // Authenticate signature and validate message
    const authResult = await authenticateSignature(
      mockRequest as any,
      walletAddress,
      validateListApiKeysMessage
    );

    if (!authResult.success) {
      return createErrorResponse(authResult.error!, 401);
    }

    try {
      // Get API keys for this wallet
      const apiKeys = await getApiKeysByWallet(walletAddress);

      // Remove sensitive data (keyHash) from response but keep keyPreview
      const sanitizedKeys = apiKeys.map(key => {
        const { keyHash, ...publicKey } = key;
        return publicKey;
      });

      const response: ListApiKeysResponse = {
        status: 'success',
        apiKeys: sanitizedKeys
      };

      return createSuccessResponse(response);

    } catch (error) {
      console.error('Failed to list API keys:', error);
      return createErrorResponse('Failed to retrieve API keys', 500);
    }

  } catch (error) {
    console.error('API key listing error:', error);
    return createErrorResponse('Invalid request format', 400);
  }
}