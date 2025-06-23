import { NextRequest, NextResponse } from 'next/server';
import { verifySignedRequest } from 'blaze-sdk';
import { validateApiKey, logApiKeyUsage } from './store';
import { 
  ApiKeyPermission, 
  ApiKeyErrorCode,
  CreateApiKeyMessage,
  ListApiKeysMessage,
  DeleteApiKeyMessage,
  VALIDATION_RULES
} from './types';

/**
 * Middleware for API key authentication
 * Validates API key and returns authorization result
 */
export async function authenticateApiKey(
  request: NextRequest,
  requiredWalletAddress: string,
  requiredPermission?: ApiKeyPermission
): Promise<{
  success: boolean;
  error?: string;
  keyId?: string;
  rateLimitHeaders?: Record<string, string>;
}> {
  const apiKey = request.headers.get('x-api-key');
  
  if (!apiKey) {
    return { success: false, error: 'API key required' };
  }

  const startTime = Date.now();
  const endpoint = request.url;
  const method = request.method;

  try {
    const validation = await validateApiKey(
      apiKey, 
      requiredWalletAddress, 
      requiredPermission
    );

    const responseTime = Date.now() - startTime;

    if (!validation.valid) {
      // Log failed attempt
      if (validation.keyRecord) {
        await logApiKeyUsage(
          validation.keyRecord.id,
          endpoint,
          method,
          false,
          validation.error,
          responseTime
        );
      }

      return { 
        success: false, 
        error: validation.error,
        rateLimitHeaders: validation.rateLimitInfo ? {
          'X-RateLimit-Limit': validation.rateLimitInfo.limit.toString(),
          'X-RateLimit-Remaining': validation.rateLimitInfo.remaining.toString(),
          'X-RateLimit-Reset': validation.rateLimitInfo.reset.toString(),
          'X-RateLimit-Window': validation.rateLimitInfo.window.toString()
        } : undefined
      };
    }

    // Log successful request
    await logApiKeyUsage(
      validation.keyRecord!.id,
      endpoint,
      method,
      true,
      undefined,
      responseTime
    );

    const rateLimitHeaders = validation.rateLimitInfo ? {
      'X-RateLimit-Limit': validation.rateLimitInfo.limit.toString(),
      'X-RateLimit-Remaining': validation.rateLimitInfo.remaining.toString(),
      'X-RateLimit-Reset': validation.rateLimitInfo.reset.toString(),
      'X-RateLimit-Window': validation.rateLimitInfo.window.toString()
    } : undefined;

    return {
      success: true,
      keyId: validation.keyRecord!.id,
      rateLimitHeaders
    };

  } catch (error) {
    console.error('API key authentication error:', error);
    return { 
      success: false, 
      error: 'Authentication service error' 
    };
  }
}

/**
 * Middleware for signature-based authentication (for API key management)
 */
export async function authenticateSignature(
  request: NextRequest,
  expectedWalletAddress: string,
  messageValidation?: (message: any) => boolean
): Promise<{
  success: boolean;
  error?: string;
  parsedMessage?: any;
}> {
  try {
    const body = await request.clone().json();
    const { message, signature, walletAddress } = body;

    if (!message || !signature || !walletAddress) {
      return {
        success: false,
        error: 'Missing required fields: message, signature, walletAddress'
      };
    }

    if (walletAddress !== expectedWalletAddress) {
      return {
        success: false,
        error: 'Wallet address mismatch'
      };
    }

    // Verify signature
    const authResult = await verifySignedRequest(request, {
      message,
      expectedAddress: walletAddress
    });

    if (!authResult.ok) {
      return {
        success: false,
        error: authResult.error || 'Signature verification failed'
      };
    }

    // Parse and validate message
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch (error) {
      return {
        success: false,
        error: 'Invalid message format'
      };
    }

    // Validate timestamp (must be within 5 minutes)
    if (parsedMessage.timestamp) {
      const now = Date.now();
      const messageTime = parsedMessage.timestamp;
      const timeDiff = Math.abs(now - messageTime);
      
      if (timeDiff > 5 * 60 * 1000) { // 5 minutes
        return {
          success: false,
          error: ApiKeyErrorCode.EXPIRED_TIMESTAMP
        };
      }
    }

    // Custom message validation
    if (messageValidation && !messageValidation(parsedMessage)) {
      return {
        success: false,
        error: 'Invalid message content'
      };
    }

    return {
      success: true,
      parsedMessage
    };

  } catch (error) {
    console.error('Signature authentication error:', error);
    return {
      success: false,
      error: 'Authentication service error'
    };
  }
}

/**
 * Validation functions for different message types
 */
export function validateCreateApiKeyMessage(message: any): message is CreateApiKeyMessage {
  if (message.action !== 'create_api_key') return false;
  if (!message.keyName || typeof message.keyName !== 'string') return false;
  if (!Array.isArray(message.permissions)) return false;
  if (!message.timestamp || typeof message.timestamp !== 'number') return false;

  // Validate key name
  if (message.keyName.length < VALIDATION_RULES.name.minLength ||
      message.keyName.length > VALIDATION_RULES.name.maxLength ||
      !VALIDATION_RULES.name.pattern.test(message.keyName)) {
    return false;
  }

  // Validate permissions
  if (message.permissions.length < VALIDATION_RULES.permissions.minCount ||
      message.permissions.length > VALIDATION_RULES.permissions.maxCount) {
    return false;
  }

  for (const permission of message.permissions) {
    if (!VALIDATION_RULES.permissions.allowedValues.includes(permission)) {
      return false;
    }
  }

  // Validate expiration date if provided
  if (message.expiresAt) {
    try {
      const expirationDate = new Date(message.expiresAt);
      if (expirationDate <= new Date()) {
        return false; // Cannot expire in the past
      }
    } catch {
      return false;
    }
  }

  return true;
}

export function validateListApiKeysMessage(message: any): message is ListApiKeysMessage {
  if (message.action !== 'list_api_keys') return false;
  if (!message.timestamp || typeof message.timestamp !== 'number') return false;
  return true;
}

export function validateDeleteApiKeyMessage(message: any): message is DeleteApiKeyMessage {
  if (message.action !== 'delete_api_key') return false;
  if (!message.keyId || typeof message.keyId !== 'string') return false;
  if (!message.timestamp || typeof message.timestamp !== 'number') return false;
  return true;
}

/**
 * Validate wallet address format
 */
export function validateWalletAddress(address: string): boolean {
  return VALIDATION_RULES.walletAddress.pattern.test(address);
}

/**
 * Helper to create error responses with consistent format
 */
export function createErrorResponse(
  error: string, 
  status: number = 400,
  details?: Record<string, any>
): NextResponse {
  return NextResponse.json({
    error,
    details,
    timestamp: new Date().toISOString()
  }, { status });
}

/**
 * Helper to create success responses with rate limit headers
 */
export function createSuccessResponse(
  data: any,
  rateLimitHeaders?: Record<string, string>
): NextResponse {
  const response = NextResponse.json({
    status: 'success',
    ...data
  });

  if (rateLimitHeaders) {
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Enhanced authentication for order operations
 * Supports both API key and signature authentication
 */
export async function authenticateOrderOperation(
  request: NextRequest,
  requiredWalletAddress: string,
  requiredPermission: ApiKeyPermission,
  orderUuid: string
): Promise<{
  success: boolean;
  error?: string;
  authMethod?: 'api_key' | 'signature';
  rateLimitHeaders?: Record<string, string>;
}> {
  const apiKey = request.headers.get('x-api-key');

  if (apiKey) {
    // Try API key authentication first
    const apiKeyAuth = await authenticateApiKey(
      request,
      requiredWalletAddress,
      requiredPermission
    );

    return {
      success: apiKeyAuth.success,
      error: apiKeyAuth.error,
      authMethod: 'api_key',
      rateLimitHeaders: apiKeyAuth.rateLimitHeaders
    };
  } else {
    // Fall back to signature authentication
    const signatureAuth = await verifySignedRequest(request, {
      message: orderUuid,
      expectedAddress: requiredWalletAddress
    });

    if (!signatureAuth.ok) {
      return {
        success: false,
        error: 'Signature verification failed',
        authMethod: 'signature'
      };
    }

    return {
      success: true,
      authMethod: 'signature'
    };
  }
}