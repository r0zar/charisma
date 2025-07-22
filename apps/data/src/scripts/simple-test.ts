#!/usr/bin/env tsx

/**
 * Simple test to isolate the exact issue
 */

async function testSimpleBatch() {
  console.log('🧪 SIMPLE BATCH TEST');
  console.log('='.repeat(30));

  // Simulate the putBatch logic manually
  console.log('📝 Testing batch logic manually...');

  // Create a mock root blob
  const rootBlob = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    addresses: {},
    contracts: {},
    prices: {},
    metadata: { totalSize: 0, entryCount: 0, regions: ['us-east-1'] }
  };

  console.log('Initial state:', {
    addresses: Object.keys(rootBlob.addresses).length,
    contracts: Object.keys(rootBlob.contracts).length,
    prices: Object.keys(rootBlob.prices).length
  });

  // Simulate the batch updates
  const updates = [
    { 
      path: 'addresses', 
      data: {
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9': { balance: '1000000' },
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS': { balance: '2000000' },
        'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1': { balance: '3000000' }
      }
    },
    { 
      path: 'contracts', 
      data: {
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': { symbol: 'CHA' },
        'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token': { symbol: 'WELSH' }
      }
    },
    { 
      path: 'prices', 
      data: {
        'CHA-USDA': { price: '1.25' },
        'WELSH-USDA': { price: '0.0001' }
      }
    }
  ];

  // Apply updates using the same logic as putBatch
  for (const { path, data } of updates) {
    console.log(`\n🔧 Applying update to path: ${path}`);
    console.log(`  Data keys: ${Object.keys(data).length}`);
    
    const pathParts = path.replace('.json', '').split('/');
    console.log(`  Path parts: [${pathParts.join(', ')}]`);
    
    let current: any = rootBlob;

    // Navigate to parent (this should do nothing for single-part paths like 'addresses')
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      console.log(`    Navigating to parent part: ${part}`);
      if (!(part in current)) {
        current[part] = {};
        console.log(`    Created new parent object for: ${part}`);
      }
      current = current[part];
    }

    // Set the final value
    const finalKey = pathParts[pathParts.length - 1];
    console.log(`  Setting finalKey '${finalKey}' with ${Object.keys(data).length} items`);
    
    // Show what we're about to assign
    console.log(`  Before assignment - current[${finalKey}] has ${Object.keys(current[finalKey] || {}).length} items`);
    current[finalKey] = data;
    console.log(`  After assignment - current[${finalKey}] has ${Object.keys(current[finalKey] || {}).length} items`);

    // Check root blob state
    console.log('  Root blob state after this update:', {
      addresses: Object.keys(rootBlob.addresses).length,
      contracts: Object.keys(rootBlob.contracts).length,  
      prices: Object.keys(rootBlob.prices).length
    });
  }

  console.log('\n📊 Final Result:');
  console.log('  - Addresses:', Object.keys(rootBlob.addresses).length);
  console.log('  - Contracts:', Object.keys(rootBlob.contracts).length);
  console.log('  - Prices:', Object.keys(rootBlob.prices).length);

  if (Object.keys(rootBlob.addresses).length === 3) {
    console.log('✅ Logic test PASSED - addresses preserved');
  } else {
    console.log('❌ Logic test FAILED - addresses not preserved');
    console.log('🔍 Address keys found:', Object.keys(rootBlob.addresses));
  }

  console.log('\n📋 Full root blob structure:');
  console.log(JSON.stringify(rootBlob, null, 2));
}

testSimpleBatch();