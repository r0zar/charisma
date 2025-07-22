/**
 * Blob Builder - Convert price engine output to blob format
 * 
 * Provides utilities to convert price engine results into the blob storage format
 */

import type { OraclePriceResult } from '../engines/oracle-price-engine';
import type { PriceBlobData } from './simple-blob-storage';

/**
 * Create a properly formatted blob from Oracle price engine results
 * This is the standard way to convert Map<string, OraclePriceResult> to PriceBlobData
 */
export function createBlobFromPriceResults(
  priceResults: Map<string, OraclePriceResult>, 
  timestamp: string = Date.now().toString()
): PriceBlobData {
  const blobData: PriceBlobData = {};
  
  priceResults.forEach((oracleResult, tokenId) => {
    if (!blobData[tokenId]) {
      blobData[tokenId] = {};
    }
    
    // Convert OraclePriceResult to simplified TokenPriceEntry format
    blobData[tokenId][timestamp] = {
      tokenId: tokenId,
      usdPrice: oracleResult.price.usdPrice,
      sbtcRatio: oracleResult.price.sbtcRatio,
      source: oracleResult.oracleResults.filter(r => r.success).map(r => r.adapterName).join(','),
      timestamp: oracleResult.metadata.timestamp
    };
  });
  
  return blobData;
}

/**
 * Append new price data to an existing blob
 */
export function appendPricesToBlob(
  existingBlob: PriceBlobData, 
  prices: Map<string, OraclePriceResult>, 
  timestamp: string
): PriceBlobData {
  const updated = { ...existingBlob };

  prices.forEach((oracleResult, tokenId) => {
    if (!updated[tokenId]) {
      updated[tokenId] = {};
    }

    // Convert OraclePriceResult to simplified TokenPriceEntry format
    updated[tokenId][timestamp] = {
      tokenId: tokenId,
      usdPrice: oracleResult.price.usdPrice,
      sbtcRatio: oracleResult.price.sbtcRatio,
      source: oracleResult.oracleResults.filter(r => r.success).map(r => r.adapterName).join(','),
      timestamp: oracleResult.metadata.timestamp
    };
  });

  return updated;
}


/**
 * Serialize blob data to JSON string with BigInt support
 */
export function serializeBlobData(blobData: PriceBlobData): string {
  return JSON.stringify(blobData, jsonReplacer, 2);
}

/**
 * Deserialize blob data from JSON string with BigInt support
 */
export function deserializeBlobData(jsonString: string): PriceBlobData {
  return JSON.parse(jsonString, jsonReviver);
}

// JSON serialization helpers - simplified (no BigInt handling needed)
export function jsonReplacer(key: string, value: any): any {
  return value;
}

export function jsonReviver(key: string, value: any): any {
  return value;
}