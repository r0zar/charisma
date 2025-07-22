/**
 * Default CRUD operations for blob storage
 */

import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '../storage/unified-blob-storage';
import { getCachePolicy, generateCacheHeaders } from '../utils/cache-strategy';
import type { CrudOperation, RouteContext } from './types';

/**
 * Default CRUD operations that work with blob storage
 */
export const defaultCrudOperations: CrudOperation = {
  /**
   * GET operation - Retrieve data from blob path
   */
  async get(blobPath: string, context: RouteContext): Promise<NextResponse> {
    context.performance.addMark('crud-get-start');
    
    try {
      const data = await unifiedBlobStorage.get(blobPath);
      
      // Generate appropriate cache headers based on path
      const cachePolicy = getCachePolicy(context.path);
      const headers = generateCacheHeaders(cachePolicy, {
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID
      });
      
      context.performance.addMark('crud-get-complete');
      const responseTime = context.performance.getMarks()['crud-get-complete'] - 
                          context.performance.getMarks()['crud-get-start'];
      
      headers.set('X-Response-Time', `${responseTime}ms`);
      headers.set('X-Data-Source', 'blob-storage');
      headers.set('X-Blob-Path', blobPath);
      
      return NextResponse.json(data, { headers });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Data not found',
            path: blobPath,
            timestamp: new Date().toISOString()
          },
          { status: 404 }
        );
      }
      
      throw error;
    }
  },

  /**
   * POST operation - Create new data at blob path
   */
  async post(blobPath: string, data: any, context: RouteContext): Promise<NextResponse> {
    context.performance.addMark('crud-post-start');
    
    // Check if data already exists
    try {
      await unifiedBlobStorage.get(blobPath);
      return NextResponse.json(
        {
          error: 'Data already exists at path',
          path: blobPath,
          suggestion: 'Use PUT to update existing data'
        },
        { status: 409 }
      );
    } catch (error) {
      // Expected - data doesn't exist, we can create it
    }
    
    await unifiedBlobStorage.put(blobPath, data);
    
    context.performance.addMark('crud-post-complete');
    
    return NextResponse.json({
      success: true,
      message: 'Data created successfully',
      path: blobPath,
      timestamp: new Date().toISOString()
    }, { status: 201 });
  },

  /**
   * PUT operation - Update/create data at blob path
   */
  async put(blobPath: string, data: any, context: RouteContext): Promise<NextResponse> {
    context.performance.addMark('crud-put-start');
    
    await unifiedBlobStorage.put(blobPath, data);
    
    context.performance.addMark('crud-put-complete');
    
    return NextResponse.json({
      success: true,
      message: 'Data updated successfully',
      path: blobPath,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * DELETE operation - Remove data at blob path
   */
  async delete(blobPath: string, context: RouteContext): Promise<NextResponse> {
    context.performance.addMark('crud-delete-start');
    
    try {
      await unifiedBlobStorage.delete(blobPath);
      
      context.performance.addMark('crud-delete-complete');
      
      return NextResponse.json({
        success: true,
        message: 'Data deleted successfully',
        path: blobPath,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Data not found',
            path: blobPath,
            timestamp: new Date().toISOString()
          },
          { status: 404 }
        );
      }
      
      throw error;
    }
  }
};

/**
 * Validate request data for POST/PUT operations
 */
export function validateRequestData(context: RouteContext): any {
  const { request, method } = context;
  
  if (method === 'POST' || method === 'PUT') {
    // For now, accept any JSON data
    // Can be extended with schema validation
    return request.json();
  }
  
  return null;
}