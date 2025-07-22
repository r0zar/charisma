import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Spider harvester to search all blob storage for hidden/lost data
 * GET /api/cron/harvest-blob-data
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('[BlobHarvester] Starting comprehensive blob storage spider...');
    
    // List all blobs in storage (limit to avoid timeout)
    const { blobs } = await list({ limit: 500 });
    console.log(`[BlobHarvester] Found ${blobs.length} total blobs (limited to 500 for performance)`);
    
    const harvestResults = {
      blobsScanned: 0,
      dataFound: {
        contracts: [] as any[],
        addresses: [] as any[],
        prices: [] as any[],
        tokens: [] as any[],
        metadata: [] as any[],
        images: [] as any[],
        unknown: [] as any[]
      },
      patterns: {
        contractIds: new Set<string>(),
        addresses: new Set<string>(),
        symbols: new Set<string>(),
        sources: new Set<string>()
      },
      errors: [] as string[]
    };
    
    // Process each blob with timeout protection
    for (const blob of blobs) {
      try {
        harvestResults.blobsScanned++;
        console.log(`[BlobHarvester] Scanning blob ${harvestResults.blobsScanned}/${blobs.length}: ${blob.pathname}`);
        
        // Skip our own unified blob to avoid recursion
        if (blob.pathname.includes('v1/root.json')) {
          console.log(`[BlobHarvester] Skipping unified blob to avoid recursion`);
          continue;
        }
        
        // Process both JSON-like files and images (for metadata analysis)
        const isJsonLike = blob.pathname.endsWith('.json') || 
                          blob.pathname.includes('metadata') ||
                          blob.pathname.includes('data');
        
        const isImage = blob.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
        
        if (!isJsonLike && !isImage) {
          console.log(`[BlobHarvester] Skipping unsupported file: ${blob.pathname}`);
          continue;
        }
        
        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(blob.url, { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          harvestResults.errors.push(`Failed to fetch ${blob.pathname}: ${response.status}`);
          continue;
        }
        
        let data: any;
        let analysis: any;
        
        if (isImage) {
          // For images, analyze the filename and metadata for contract/address patterns
          console.log(`[BlobHarvester] Analyzing image metadata: ${blob.pathname}`);
          analysis = await analyzeImageMetadata(blob, blob.pathname);
        } else {
          // For JSON-like files, parse and analyze content
          const content = await response.text();
          
          try {
            data = JSON.parse(content);
            console.log(`[BlobHarvester] Analyzing JSON data: ${blob.pathname}`);
            analysis = await analyzeDataStructure(data, blob.pathname);
          } catch (parseError) {
            harvestResults.errors.push(`Failed to parse JSON for ${blob.pathname}`);
            continue;
          }
        }
        
        // Categorize found data
        if (analysis.contracts.length > 0) {
          harvestResults.dataFound.contracts.push({
            source: blob.pathname,
            data: analysis.contracts,
            lastModified: blob.uploadedAt
          });
          analysis.contracts.forEach((contract: any) => {
            if (contract.contractId) harvestResults.patterns.contractIds.add(contract.contractId);
            if (contract.address) harvestResults.patterns.addresses.add(contract.address);
          });
        }
        
        if (analysis.addresses.length > 0) {
          harvestResults.dataFound.addresses.push({
            source: blob.pathname,
            data: analysis.addresses,
            lastModified: blob.uploadedAt
          });
          analysis.addresses.forEach((addr: any) => {
            if (addr.address) harvestResults.patterns.addresses.add(addr.address);
          });
        }
        
        if (analysis.prices.length > 0) {
          harvestResults.dataFound.prices.push({
            source: blob.pathname,
            data: analysis.prices,
            lastModified: blob.uploadedAt
          });
          analysis.prices.forEach((price: any) => {
            if (price.symbol) harvestResults.patterns.symbols.add(price.symbol);
          });
        }
        
        if (analysis.tokens.length > 0) {
          harvestResults.dataFound.tokens.push({
            source: blob.pathname,
            data: analysis.tokens,
            lastModified: blob.uploadedAt
          });
          analysis.tokens.forEach((token: any) => {
            if (token.contractId) harvestResults.patterns.contractIds.add(token.contractId);
            if (token.symbol) harvestResults.patterns.symbols.add(token.symbol);
          });
        }
        
        if (analysis.metadata.length > 0) {
          harvestResults.dataFound.metadata.push({
            source: blob.pathname,
            data: analysis.metadata,
            lastModified: blob.uploadedAt
          });
        }
        
        if (analysis.images && analysis.images.length > 0) {
          harvestResults.dataFound.images.push({
            source: blob.pathname,
            data: analysis.images,
            lastModified: blob.uploadedAt
          });
        }
        
        if (analysis.unknown.length > 0) {
          harvestResults.dataFound.unknown.push({
            source: blob.pathname,
            data: analysis.unknown,
            lastModified: blob.uploadedAt
          });
        }
        
        // Track sources
        if (analysis.source) {
          harvestResults.patterns.sources.add(analysis.source);
        }
        
      } catch (error) {
        harvestResults.errors.push(`Error processing ${blob.pathname}: ${error}`);
        console.warn(`[BlobHarvester] Error processing ${blob.pathname}:`, error);
      }
    }
    
    // Now harvest the valuable data into our unified structure
    const harvestUpdates = await processHarvestedData(harvestResults);
    
    // Store discovered data
    await storeDiscoveredData(harvestUpdates, harvestResults);
    
    const processingTime = Date.now() - startTime;
    
    // Convert Sets to arrays for JSON serialization
    const summary = {
      blobsScanned: harvestResults.blobsScanned,
      errorsEncountered: harvestResults.errors.length,
      dataTypesFound: {
        contracts: harvestResults.dataFound.contracts.length,
        addresses: harvestResults.dataFound.addresses.length,
        prices: harvestResults.dataFound.prices.length,
        tokens: harvestResults.dataFound.tokens.length,
        metadata: harvestResults.dataFound.metadata.length,
        images: harvestResults.dataFound.images.length,
        unknown: harvestResults.dataFound.unknown.length
      },
      patternsDiscovered: {
        contractIds: harvestResults.patterns.contractIds.size,
        addresses: harvestResults.patterns.addresses.size,
        symbols: harvestResults.patterns.symbols.size,
        sources: Array.from(harvestResults.patterns.sources)
      },
      harvestedIntoStructure: {
        contractsAdded: harvestUpdates.contracts.length,
        addressesAdded: harvestUpdates.addresses.length
      }
    };
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      summary,
      source: 'blob-spider-harvester'
    });
    
  } catch (error) {
    console.error('[BlobHarvester] Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      error: 'Failed to harvest blob data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Analyze image metadata and filename for contract/address associations
 */
async function analyzeImageMetadata(blob: any, pathname: string): Promise<{
  contracts: any[];
  addresses: any[];
  prices: any[];
  tokens: any[];
  metadata: any[];
  images: any[];
  unknown: any[];
  source?: string;
}> {
  const result = {
    contracts: [] as any[],
    addresses: [] as any[],
    prices: [] as any[],
    tokens: [] as any[],
    metadata: [] as any[],
    images: [] as any[],
    unknown: [] as any[],
    source: 'image-analysis' as string
  };

  // Analyze both filename and URL for patterns
  const filename = pathname.toLowerCase();
  
  // Check if filename or URL contains contract ID pattern
  const contractIdMatch = pathname.match(/S[PTM][0-9A-Z]{39}\.[a-z0-9-_]+/i) || 
                          blob.url.match(/S[PTM][0-9A-Z]{39}\.[a-z0-9-_]+/i);
  if (contractIdMatch) {
    const contractId = contractIdMatch[0];
    const foundLocation = pathname.match(/S[PTM][0-9A-Z]{39}\.[a-z0-9-_]+/i) ? 
                         `filename:${pathname}` : `url:${blob.url}`;
    
    result.contracts.push({
      contractId,
      address: contractId.split('.')[0],
      contractName: contractId.split('.')[1],
      associatedImage: blob.url,
      imageType: 'token-logo',
      foundAt: foundLocation,
      source: 'image-analysis'
    });
    
    // Also add the address
    result.addresses.push({
      address: contractId.split('.')[0],
      associatedImage: blob.url,
      imageType: 'contract-logo',
      foundAt: foundLocation,
      source: 'image-analysis'
    });
  }
  
  // Check for standalone address patterns (in filename or URL)
  const addressMatch = pathname.match(/S[PTM][0-9A-Z]{39}/) || 
                       blob.url.match(/S[PTM][0-9A-Z]{39}/);
  if (addressMatch && !contractIdMatch) { // Only if we didn't already catch it in contract
    const foundLocation = pathname.match(/S[PTM][0-9A-Z]{39}/) ? 
                         `filename:${pathname}` : `url:${blob.url}`;
    
    result.addresses.push({
      address: addressMatch[0],
      associatedImage: blob.url,
      imageType: 'address-logo',
      foundAt: foundLocation,
      source: 'image-analysis'
    });
  }
  
  // Check for token symbols in filename
  const commonTokenSymbols = ['btc', 'stx', 'usdc', 'alex', 'diko', 'cha', 'charisma', 'welsh', 'sbtc', 'pepe'];
  for (const symbol of commonTokenSymbols) {
    if (filename.includes(symbol.toLowerCase())) {
      result.tokens.push({
        symbol: symbol.toUpperCase(),
        associatedImage: blob.url,
        imageType: 'token-logo',
        foundAt: `filename:${pathname}`,
        source: 'image-filename-analysis'
      });
      break; // Only match first symbol found
    }
  }
  
  // Store image metadata
  result.images.push({
    pathname: blob.pathname,
    url: blob.url,
    size: blob.size,
    contentType: blob.contentType,
    uploadedAt: blob.uploadedAt,
    analysis: {
      hasContractId: !!contractIdMatch,
      hasAddress: !!addressMatch,
      hasTokenSymbol: commonTokenSymbols.some(s => filename.includes(s.toLowerCase())),
      filename: pathname
    }
  });
  
  return result;
}

/**
 * Analyze data structure to identify patterns and extract valuable data
 */
async function analyzeDataStructure(data: any, source: string): Promise<{
  contracts: any[];
  addresses: any[];
  prices: any[];
  tokens: any[];
  metadata: any[];
  unknown: any[];
  source?: string;
}> {
  const result = {
    contracts: [] as any[],
    addresses: [] as any[],
    prices: [] as any[],
    tokens: [] as any[],
    metadata: [] as any[],
    unknown: [] as any[],
    source: undefined as string | undefined
  };
  
  // Helper to detect Stacks addresses
  const isStacksAddress = (str: string) => typeof str === 'string' && /^S[PTM][0-9A-Z]{39}$/.test(str);
  
  // Helper to detect contract IDs
  const isContractId = (str: string) => typeof str === 'string' && /^S[PTM][0-9A-Z]{39}\.[a-z0-9-_]+$/.test(str);
  
  // Recursive data analysis
  const analyzeValue = (value: any, path: string = '') => {
    if (value === null || value === undefined) return;
    
    if (typeof value === 'string') {
      // Check for addresses
      if (isStacksAddress(value)) {
        result.addresses.push({
          address: value,
          foundAt: path,
          type: 'discovered',
          source: 'blob-spider'
        });
      }
      
      // Check for contract IDs
      if (isContractId(value)) {
        result.contracts.push({
          contractId: value,
          address: value.split('.')[0],
          contractName: value.split('.')[1],
          foundAt: path,
          type: 'discovered',
          source: 'blob-spider'
        });
      }
      
      return;
    }
    
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        analyzeValue(item, `${path}[${index}]`);
      });
      return;
    }
    
    if (typeof value === 'object' && value !== null) {
      // Check if this object looks like a contract
      if (value.contractId || (value.contract_principal && isContractId(value.contract_principal))) {
        result.contracts.push({
          ...value,
          contractId: value.contractId || value.contract_principal,
          foundAt: path,
          source: 'blob-spider'
        });
      }
      
      // Check if this object looks like an address record
      if (value.address && isStacksAddress(value.address)) {
        result.addresses.push({
          ...value,
          foundAt: path,
          source: 'blob-spider'
        });
      }
      
      // Check if this object looks like price data
      if ((value.price || value.usdPrice) && (value.symbol || value.token)) {
        result.prices.push({
          ...value,
          foundAt: path,
          source: 'blob-spider'
        });
      }
      
      // Check if this object looks like token metadata
      if (value.symbol && value.name && (value.decimals !== undefined)) {
        result.tokens.push({
          ...value,
          foundAt: path,
          source: 'blob-spider'
        });
      }
      
      // Check for metadata objects
      if (value.lastUpdated || value.timestamp || value.version) {
        result.metadata.push({
          ...value,
          foundAt: path,
          source: 'blob-spider'
        });
      }
      
      // Track source if present
      if (value.source && typeof value.source === 'string') {
        result.source = value.source;
      }
      
      // Recurse into object properties
      Object.entries(value).forEach(([key, val]) => {
        analyzeValue(val, path ? `${path}.${key}` : key);
      });
    }
  };
  
  analyzeValue(data);
  
  return result;
}

/**
 * Process harvested data and prepare for integration
 */
async function processHarvestedData(harvestResults: any): Promise<{
  contracts: Array<{ path: string; data: any }>;
  addresses: Array<{ path: string; data: any }>;
}> {
  const contractsUpdates: Array<{ path: string; data: any }> = [];
  const addressesUpdates: Array<{ path: string; data: any }> = [];
  
  // Process discovered contracts
  for (const contractGroup of harvestResults.dataFound.contracts) {
    for (const contract of contractGroup.data) {
      if (contract.contractId && isValidContractId(contract.contractId)) {
        const contractData = {
          contractId: contract.contractId,
          contractAddress: contract.contractId.split('.')[0],
          contractName: contract.contractId.split('.')[1],
          name: contract.name || contract.contractName || 'Discovered Contract',
          type: 'DISCOVERED',
          source: 'blob-spider-harvest',
          lastUpdated: Date.now(),
          discoveryInfo: {
            foundAt: contract.foundAt,
            originalSource: contractGroup.source,
            lastModified: contractGroup.lastModified
          },
          metadata: {
            originalData: contract
          }
        };
        
        contractsUpdates.push({
          path: `contracts/${contract.contractId}`,
          data: contractData
        });
      }
    }
  }
  
  // Process discovered addresses
  for (const addressGroup of harvestResults.dataFound.addresses) {
    for (const address of addressGroup.data) {
      if (address.address && isValidStacksAddress(address.address)) {
        const addressData = {
          address: address.address,
          type: 'discovered',
          source: 'blob-spider-harvest',
          lastUpdated: Date.now(),
          discoveryInfo: {
            foundAt: address.foundAt,
            originalSource: addressGroup.source,
            lastModified: addressGroup.lastModified
          },
          metadata: {
            originalData: address
          }
        };
        
        addressesUpdates.push({
          path: `addresses/${address.address}`,
          data: addressData
        });
      }
    }
  }
  
  return { contracts: contractsUpdates, addresses: addressesUpdates };
}

/**
 * Store discovered data in the discovered section
 */
async function storeDiscoveredData(harvestUpdates: any, harvestResults: any): Promise<void> {
  if (harvestUpdates.contracts.length > 0 || harvestUpdates.addresses.length > 0 || harvestResults.dataFound.images.length > 0) {
    const discoveredData = {
      lastUpdated: new Date().toISOString(),
      source: 'blob-spider-harvester',
      type: 'spider-crawl-data',
      summary: {
        contractsFound: harvestUpdates.contracts.length,
        addressesFound: harvestUpdates.addresses.length,
        blobsScanned: harvestResults.blobsScanned,
        imageMetadataAnalyzed: harvestResults.dataFound.images.length
      },
      contracts: {},
      addresses: {},
      images: [],
      metadata: {
        crawlResults: harvestResults
      }
    };
    
    // Add discovered contracts
    for (const update of harvestUpdates.contracts) {
      const contractId = update.path.replace('contracts/', '');
      (discoveredData.contracts as Record<string, any>)[contractId] = update.data;
    }
    
    // Add discovered addresses
    for (const update of harvestUpdates.addresses) {
      const address = update.path.replace('addresses/', '');
      (discoveredData.addresses as Record<string, any>)[address] = update.data;
    }
    
    // Add discovered images
    for (const imageGroup of harvestResults.dataFound.images) {
      (discoveredData.images as any[]).push(...imageGroup.data);
    }
    
    // Store in discovered section
    await unifiedBlobStorage.put('discovered/blob-spider', discoveredData);
    console.log(`[BlobHarvester] Stored discovered data: ${harvestUpdates.contracts.length} contracts, ${harvestUpdates.addresses.length} addresses, ${discoveredData.images.length} images`);
  }
}

/**
 * Validation helpers
 */
function isValidContractId(contractId: string): boolean {
  return typeof contractId === 'string' && /^S[PTM][0-9A-Z]{39}\.[a-z0-9-_]+$/.test(contractId);
}

function isValidStacksAddress(address: string): boolean {
  return typeof address === 'string' && /^S[PTM][0-9A-Z]{39}$/.test(address);
}

// Also support POST for cron services
export const POST = GET;