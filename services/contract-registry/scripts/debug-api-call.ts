/**
 * Debug script to test the /by_trait API endpoint directly
 */

// Simple test with direct fetch
async function testDirectFetch() {
  const trait = {
    functions: [
      { name: "transfer" },
      { name: "get-name" },
      { name: "get-symbol" },
      { name: "get-decimals" },
      { name: "get-balance" },
      { name: "get-total-supply" }
    ]
  };

  const url = `https://api.hiro.so/extended/v1/contract/by_trait?trait_abi=${encodeURIComponent(JSON.stringify(trait))}&limit=5&offset=0`;
  
  console.log('🌍 Testing direct fetch...');
  console.log('URL:', url);
  console.log('Trait JSON:', JSON.stringify(trait));

  try {
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (process.env.HIRO_API_KEY) {
      headers['x-api-key'] = process.env.HIRO_API_KEY;
    }

    const response = await fetch(url, { headers });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response body:', text);
    
    if (response.ok) {
      try {
        const data = JSON.parse(text);
        console.log('✅ Success! Found', data?.results?.length || 0, 'contracts');
      } catch (e) {
        console.log('❌ Failed to parse JSON response');
      }
    } else {
      console.log('❌ Request failed');
    }
    
  } catch (error) {
    console.log('❌ Error:', error);
  }
}

// Test via polyglot apiClient
async function testApiClient() {
  console.log('\n🔧 Testing via polyglot apiClient...');
  
  const { searchContractsByTrait } = await import('@repo/polyglot');
  
  const trait = {
    functions: [
      { name: "transfer" },
      { name: "get-name" },
      { name: "get-symbol" }
    ]
  };

  try {
    const contracts = await searchContractsByTrait(trait, { debug: true });
    console.log('✅ Found', contracts.length, 'contracts');
  } catch (error) {
    console.log('❌ Error:', error);
  }
}

async function main() {
  await testDirectFetch();
  await testApiClient();
}

main().catch(console.error);