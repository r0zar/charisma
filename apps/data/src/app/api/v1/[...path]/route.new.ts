/**
 * Simplified API routes using middleware and cache decorators
 * Clean, elegant implementation with proper separation of concerns
 */

import { NextRequest, NextResponse } from 'next/server';
import { blobStorageService } from '@/services/blob-storage-service';
import { balanceService } from '@/services/balance-service';
import { 
  withApiMiddleware, 
  withValidation, 
  withErrorHandling, 
  validators,
  combineValidators,
  compose,
  APIError,
  type APIHandler,
  type APIContext 
} from '@/lib/api-middleware';
import { smartCache } from '@/lib/cache-decorators';

export const runtime = 'edge';

/**
 * API Route Handlers
 * Each handler is focused on a single responsibility
 */
class APIRoutes {
  static async handleGet(request: NextRequest, context: APIContext): Promise<NextResponse> {
    context.performance.addMark('handler-logic-start');

    // Handle root path - return root blob directly
    if (!context.params.path || context.params.path.length === 0) {
      const rootBlob = await blobStorageService.getRootBlob();
      context.performance.addMark('root-blob-retrieved');
      
      return NextResponse.json(rootBlob);
    }

    const { parsed, blobPath, query } = context;
    
    // Handle address balance requests using balance service
    if (parsed?.type === 'addresses' && parsed.address && parsed.action === 'balances') {
      context.performance.addMark('balance-service-start');
      
      const balanceData = await balanceService.getAddressBalances(parsed.address.address);
      context.performance.addMark('balance-service-complete');

      return NextResponse.json(balanceData);
    }

    // Handle other requests via blob storage
    if (!blobPath) {
      throw new APIError('Could not determine storage path', 400);
    }

    context.performance.addMark('blob-storage-start');
    const data = await blobStorageService.get(blobPath);
    context.performance.addMark('blob-storage-complete');

    // Handle streaming if requested
    if (query.stream && typeof data === 'object' && data !== null) {
      return NextResponse.json({
        data,
        offset: query.offset,
        limit: query.limit,
        hasMore: false // Simplified - would need actual pagination logic
      });
    }

    return NextResponse.json(data);
  }

  static async handlePut(request: NextRequest, context: APIContext): Promise<NextResponse> {
    const { blobPath } = context;
    
    if (!blobPath) {
      throw new APIError('Could not determine storage path', 400);
    }

    const body = await request.json();
    
    context.performance.addMark('blob-storage-put-start');
    await blobStorageService.put(blobPath, body);
    context.performance.addMark('blob-storage-put-complete');

    return NextResponse.json({ success: true });
  }

  static async handleDelete(request: NextRequest, context: APIContext): Promise<NextResponse> {
    // For unified storage, we don't support individual deletion
    throw new APIError('Delete operations not supported in unified blob storage', 501);
  }
}

/**
 * Middleware composition for different HTTP methods
 */

const getMiddleware = compose(
  withErrorHandling,
  withValidation(combineValidators(
    // No validation needed for GET - handle empty paths in handler
  ))
);

const putMiddleware = compose(
  withErrorHandling,
  withValidation(combineValidators(
    validators.requirePath,
    validators.requireParsedPath,
    validators.requireBlobPath
  ))
);

const deleteMiddleware = compose(
  withErrorHandling,
  withValidation(combineValidators(
    validators.requirePath,
    validators.requireParsedPath,
    validators.requireBlobPath
  ))
);

/**
 * HTTP Method Handlers
 */

export const GET = withApiMiddleware(
  getMiddleware(APIRoutes.handleGet)
);

export const PUT = withApiMiddleware(
  putMiddleware(APIRoutes.handlePut)
);

export const DELETE = withApiMiddleware(
  deleteMiddleware(APIRoutes.handleDelete)
);