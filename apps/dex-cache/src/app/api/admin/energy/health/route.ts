import { NextRequest, NextResponse } from 'next/server';
import { callReadOnlyFunction } from '@repo/polyglot';
import { getAllVaultData } from '@/lib/pool-service';
import { analyzeContract } from '@/lib/contract-analysis';
import { uintCV, optionalCVOf, bufferCVFromString } from '@stacks/transactions';

interface ContractHealth {
  contractId: string;
  name: string;
  isAccessible: boolean;
  functions: {
    quote: { working: boolean; responseTime?: number; error?: string };
    tokenUri: { working: boolean; responseTime?: number; error?: string };
    engineTap: { working: boolean; responseTime?: number; error?: string };
  };
  relationships: {
    engine?: string;
    baseToken?: string;
    traits: string[];
  };
  configValidation: {
    engineMatches: boolean;
    baseTokenReferenced: boolean;
    warnings: string[];
  };
  lastChecked: string;
  overallStatus: 'healthy' | 'warning' | 'error';
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting energy contract health check...');

    // Get energy vaults
    const energyVaults = await getAllVaultData({ type: 'ENERGY' });
    
    if (energyVaults.length === 0) {
      return NextResponse.json({ 
        error: 'No energy vaults found',
        health: []
      }, { status: 404 });
    }

    const healthResults: ContractHealth[] = [];

    for (const vault of energyVaults) {
      console.log(`📊 Checking health for: ${vault.name}`);
      
      const health: ContractHealth = {
        contractId: vault.contractId,
        name: vault.name,
        isAccessible: false,
        functions: {
          quote: { working: false },
          tokenUri: { working: false },
          engineTap: { working: false }
        },
        relationships: {
          traits: []
        },
        configValidation: {
          engineMatches: true,
          baseTokenReferenced: true,
          warnings: []
        },
        lastChecked: new Date().toISOString(),
        overallStatus: 'error'
      };

      try {
        const [contractAddress, contractName] = vault.contractId.split('.');

        // Test contract functions with timeout and error handling
        console.log(`  🧪 Testing contract functions for ${vault.name}...`);
        
        // Test quote function
        try {
          const startTime = Date.now();
          const quoteResult = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'quote',
            [uintCV(0), optionalCVOf(bufferCVFromString('07'))]
          );
          const responseTime = Date.now() - startTime;
          
          health.functions.quote = {
            working: quoteResult !== null,
            responseTime,
            error: quoteResult === null ? 'No response from quote function' : undefined
          };
        } catch (error) {
          health.functions.quote = {
            working: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        // Test get-token-uri function
        try {
          const startTime = Date.now();
          const uriResult = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'get-token-uri',
            []
          );
          const responseTime = Date.now() - startTime;
          
          health.functions.tokenUri = {
            working: uriResult !== null,
            responseTime,
            error: uriResult === null ? 'No response from get-token-uri function' : undefined
          };
        } catch (error) {
          health.functions.tokenUri = {
            working: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        // Test hold-to-earn engine function if engine is configured
        if (vault.engineContractId) {
          try {
            const [engineAddress, engineName] = vault.engineContractId.split('.');
            const startTime = Date.now();
            const tapResult = await callReadOnlyFunction(
              engineAddress,
              engineName,
              'get-last-tap-block',
              [/* principalCV(contractAddress) */] // Commenting out to avoid errors
            );
            const responseTime = Date.now() - startTime;
            
            health.functions.engineTap = {
              working: tapResult !== null,
              responseTime,
              error: tapResult === null ? 'No response from engine tap function' : undefined
            };
          } catch (error) {
            health.functions.engineTap = {
              working: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        }

        // Mark as accessible if at least one function works
        health.isAccessible = health.functions.quote.working || health.functions.tokenUri.working;

        // Analyze contract relationships using our contract-analysis library
        console.log(`  🔬 Analyzing contract relationships for ${vault.name}...`);
        try {
          const contractAnalysis = await analyzeContract(vault.contractId);
          
          if (contractAnalysis) {
            // Extract relationships
            const engineRelationship = contractAnalysis.relationships.find(rel => 
              rel.targetContract.includes('hold-to-earn')
            );
            
            if (engineRelationship) {
              health.relationships.engine = engineRelationship.targetContract;
            }

            const baseTokenRelationship = contractAnalysis.relationships.find(rel =>
              rel.targetContract.includes('pool') || rel.targetContract.includes('token')
            );
            
            if (baseTokenRelationship) {
              health.relationships.baseToken = baseTokenRelationship.targetContract;
            }

            health.relationships.traits = contractAnalysis.traits;

            // Validate configuration against contract analysis
            if (vault.engineContractId && engineRelationship) {
              health.configValidation.engineMatches = vault.engineContractId === engineRelationship.targetContract;
              if (!health.configValidation.engineMatches) {
                health.configValidation.warnings.push(
                  `Configured engine (${vault.engineContractId}) differs from contract source (${engineRelationship.targetContract})`
                );
              }
            } else if (vault.engineContractId && !engineRelationship) {
              health.configValidation.warnings.push(
                'Configured engine not found in contract source code'
              );
              health.configValidation.engineMatches = false;
            }

            if (vault.base && baseTokenRelationship) {
              health.configValidation.baseTokenReferenced = vault.base === baseTokenRelationship.targetContract;
              if (!health.configValidation.baseTokenReferenced) {
                health.configValidation.warnings.push(
                  `Configured base token (${vault.base}) differs from contract reference (${baseTokenRelationship.targetContract})`
                );
              }
            }
          }
        } catch (analysisError) {
          console.log(`  ⚠️ Contract analysis failed: ${analysisError}`);
          health.configValidation.warnings.push('Contract analysis failed');
        }

        // Determine overall status
        const functionsWorking = Object.values(health.functions).filter(f => f.working).length;
        const totalFunctions = Object.values(health.functions).length;
        const hasWarnings = health.configValidation.warnings.length > 0;
        
        if (!health.isAccessible || functionsWorking === 0) {
          health.overallStatus = 'error';
        } else if (functionsWorking < totalFunctions || hasWarnings) {
          health.overallStatus = 'warning';
        } else {
          health.overallStatus = 'healthy';
        }

        console.log(`  ✅ Health check complete for ${vault.name}: ${health.overallStatus}`);

      } catch (error) {
        console.log(`  ❌ Health check failed for ${vault.name}: ${error}`);
        health.configValidation.warnings.push(`Health check error: ${error}`);
        health.overallStatus = 'error';
      }

      healthResults.push(health);
    }

    console.log(`🎯 Health check complete for ${healthResults.length} vault(s)`);

    return NextResponse.json({
      health: healthResults,
      summary: {
        total: healthResults.length,
        healthy: healthResults.filter(h => h.overallStatus === 'healthy').length,
        warning: healthResults.filter(h => h.overallStatus === 'warning').length,
        error: healthResults.filter(h => h.overallStatus === 'error').length,
        lastChecked: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Energy health check failed:', error);
    return NextResponse.json({ 
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}