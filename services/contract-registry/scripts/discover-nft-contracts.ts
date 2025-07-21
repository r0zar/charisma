#!/usr/bin/env tsx

/**
 * NFT Contract Discovery Script
 * 
 * Discovers NFT collections on-chain using concurrent batches with real-time progress updates.
 * Focuses on finding SIP009 NFT contracts and other NFT-like patterns.
 */

import { ContractRegistry, createDefaultConfig, type ContractRegistryConfig } from '../src/index';
import type { DiscoveryOrchestrationConfig, DiscoveryResult } from '../src/types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface ProgressInfo {
  phase: 'setup' | 'discovering' | 'processing' | 'analyzing' | 'completed';
  current: number;
  total: number;
  percentage: number;
  currentBatch?: number;
  totalBatches?: number;
  currentContract?: string;
  message?: string;
  stats?: {
    discovered: number;
    processed: number;
    added: number;
    errors: number;
  };
}

interface DiscoveryStats {
  totalDiscovered: number;
  totalProcessed: number;
  totalAdded: number;
  totalErrors: number;
  batchesCompleted: number;
  duration: number;
  contractsPerSecond: number;
}

/**
 * Create a progress bar with batch information
 */
function createProgressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.floor((current / total) * 100);
  const filledWidth = Math.floor((current / total) * width);
  const emptyWidth = width - filledWidth;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  return `[${filled}${empty}] ${percentage}% (${current}/${total})`;
}

/**
 * Enhanced ContractRegistry with concurrent discovery and progress callbacks
 */
class ConcurrentDiscoveryRegistry extends ContractRegistry {
  private onProgress?: (progress: ProgressInfo) => void;

  constructor(config: ContractRegistryConfig, onProgress?: (progress: ProgressInfo) => void) {
    super(config);
    this.onProgress = onProgress;
  }

  /**
   * Discover NFT contracts with concurrent processing and progress tracking
   */
  async discoverNFTContracts(options: {
    batchSize?: number;
    maxConcurrency?: number;
    includeSIP009?: boolean;
    includeCustomTraits?: boolean;
    dryRun?: boolean;
  }): Promise<DiscoveryStats> {
    const startTime = Date.now();
    const {
      batchSize = 50,
      maxConcurrency = 3,
      includeSIP009 = true,
      includeCustomTraits = true,
      dryRun = false
    } = options;

    let totalDiscovered = 0;
    let totalProcessed = 0;
    let totalAdded = 0;
    let totalErrors = 0;
    let batchesCompleted = 0;

    // Report setup phase
    if (this.onProgress) {
      this.onProgress({
        phase: 'setup',
        current: 0,
        total: 100,
        percentage: 0,
        message: 'Configuring NFT discovery patterns...'
      });
    }

    // Configure discovery patterns for NFTs
    const discoveryConfig: DiscoveryOrchestrationConfig = {
      traits: [],
      sipStandards: [],
      apiScan: {
        enabled: false,
        batchSize,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        blacklist: []
      }
    };

    // Add SIP009 NFT standard discovery
    if (includeSIP009) {
      discoveryConfig.sipStandards!.push({
        sipNumber: 'SIP009',
        trait: {
          name: 'SIP009 Non-Fungible Token',
          description: 'Standard Non-Fungible Token (SIP009) implementation',
          functions: [
            {
              name: "get-last-token-id",
              access: "read_only",
              args: [],
              outputs: {
                type: {
                  response: {
                    ok: "uint128",
                    error: "uint128"
                  }
                }
              }
            },
            {
              name: "get-token-uri",
              access: "read_only",
              args: [{ name: "token-id", type: "uint128" }],
              outputs: {
                type: {
                  response: {
                    ok: { optional: { "string-ascii": { length: 256 } } },
                    error: "uint128"
                  }
                }
              }
            },
            {
              name: "get-owner",
              access: "read_only",
              args: [{ name: "token-id", type: "uint128" }],
              outputs: {
                type: {
                  response: {
                    ok: { optional: "principal" },
                    error: "uint128"
                  }
                }
              }
            },
            {
              name: "transfer",
              access: "public",
              args: [
                { name: "token-id", type: "uint128" },
                { name: "sender", type: "principal" },
                { name: "recipient", type: "principal" }
              ],
              outputs: {
                type: {
                  response: {
                    ok: "bool",
                    error: "uint128"
                  }
                }
              }
            }
          ]
        },
        enabled: true
      });
    }

    // Add custom NFT trait patterns
    if (includeCustomTraits) {
      discoveryConfig.traits!.push(
        {
          trait: {
            name: 'Non-Fungible Transferable Trait',
            description: 'Contracts with transferable NFT functionality',
            functions: [
              {
                name: "transfer",
                access: "public",
                args: [
                  { name: "amount", type: "uint128" },
                  { name: "sender", type: "principal" },
                  { name: "recipient", type: "principal" },
                  { name: "memo", type: { optional: { buffer: { length: 34 } } } }
                ],
                outputs: {
                  type: {
                    response: {
                      ok: "bool",
                      error: "uint128"
                    }
                  }
                }
              },
            ]
          },
          enabled: true,
          priority: 3,
          batchSize
        },
        // Mint function trait (common in NFTs)
        {
          trait: {
            name: 'NFT Mint Function',
            description: 'Contracts with mint functionality for NFTs',
            functions: [
              {
                name: "mint",
                access: "public",
                args: [],
                outputs: {
                  type: {
                    response: {
                      ok: "uint128",
                      error: "uint128"
                    }
                  }
                }
              }
            ]
          },
          enabled: true,
          priority: 2,
          batchSize
        },
        // Token URI trait (NFT metadata)
        {
          trait: {
            name: 'Token URI Trait',
            description: 'Contracts with token URI functionality',
            functions: [
              {
                name: "get-token-uri",
                access: "read_only",
                args: [{ name: "token-id", type: "uint128" }],
                outputs: {
                  type: {
                    response: {
                      ok: { optional: { "string-ascii": { length: 256 } } },
                      error: "uint128"
                    }
                  }
                }
              }
            ]
          },
          enabled: true,
          priority: 3,
          batchSize
        },
        // Collection info trait
        {
          trait: {
            name: 'Collection Info Trait',
            description: 'Contracts with collection information',
            functions: [
              {
                name: "get-collection-info",
                access: "read_only",
                args: [],
                outputs: {
                  type: {
                    response: {
                      ok: {
                        tuple: [
                          { name: "name", type: { "string-utf8": { length: 64 } } },
                          { name: "description", type: { "string-utf8": { length: 256 } } }
                        ]
                      },
                      error: "none"
                    }
                  }
                }
              }
            ]
          },
          enabled: true,
          priority: 4,
          batchSize
        }
      );
    }


    const allDiscoveryMethods = [
      ...(discoveryConfig.sipStandards || []).map(s => ({ type: 'sip', name: s.sipNumber })),
      ...(discoveryConfig.traits || []).map(t => ({ type: 'trait', name: t.trait.name }))
    ];

    const totalMethods = allDiscoveryMethods.length;

    if (this.onProgress) {
      this.onProgress({
        phase: 'discovering',
        current: 0,
        total: totalMethods,
        percentage: 0,
        totalBatches: totalMethods,
        currentBatch: 0,
        message: `Starting discovery with ${totalMethods} patterns...`,
        stats: { discovered: 0, processed: 0, added: 0, errors: 0 }
      });
    }

    if (dryRun) {
      console.log('\n🔍 DRY RUN: Discovery configuration:');
      console.log(`  • NFT Standards: ${discoveryConfig.sipStandards?.length || 0}`);
      console.log(`  • Custom Traits: ${discoveryConfig.traits?.length || 0}`);
      console.log(`  • Batch Size: ${batchSize}`);
      console.log(`  • Max Concurrency: ${maxConcurrency}`);
      return {
        totalDiscovered: 0,
        totalProcessed: 0,
        totalAdded: 0,
        totalErrors: 0,
        batchesCompleted: 0,
        duration: Date.now() - startTime,
        contractsPerSecond: 0
      };
    }

    // Process discovery methods in concurrent batches
    const discoveryPromises: Promise<DiscoveryResult>[] = [];
    const semaphore = new Array(maxConcurrency).fill(null);

    for (let i = 0; i < allDiscoveryMethods.length; i++) {
      const method = allDiscoveryMethods[i];

      // Wait for an available slot
      await Promise.race(semaphore.map(async (_, slotIndex) => {
        if (semaphore[slotIndex] === null) {
          // Start discovery for this method
          const discoveryPromise = this.runSingleDiscovery(method, discoveryConfig, i + 1, totalMethods);
          semaphore[slotIndex] = discoveryPromise;

          // When done, free the slot and update progress
          discoveryPromise.then((result) => {
            semaphore[slotIndex] = null;
            batchesCompleted++;
            totalDiscovered += result.contractsFound;
            totalProcessed += result.contractsProcessed;
            totalAdded += result.contractsAdded;
            if (!result.success) totalErrors++;

            if (this.onProgress) {
              this.onProgress({
                phase: 'discovering',
                current: batchesCompleted,
                total: totalMethods,
                percentage: Math.floor((batchesCompleted / totalMethods) * 100),
                totalBatches: totalMethods,
                currentBatch: batchesCompleted,
                currentContract: method.name,
                message: `Completed ${method.type}: ${method.name}`,
                stats: {
                  discovered: totalDiscovered,
                  processed: totalProcessed,
                  added: totalAdded,
                  errors: totalErrors
                }
              });
            }
          }).catch(() => {
            semaphore[slotIndex] = null;
            totalErrors++;
            batchesCompleted++;
          });

          discoveryPromises.push(discoveryPromise);
          return;
        }
      }));
    }

    // Wait for all discoveries to complete
    if (this.onProgress) {
      this.onProgress({
        phase: 'processing',
        current: 0,
        total: 100,
        percentage: 0,
        message: 'Waiting for all discovery batches to complete...',
        stats: { discovered: totalDiscovered, processed: totalProcessed, added: totalAdded, errors: totalErrors }
      });
    }

    await Promise.allSettled(discoveryPromises);

    // Final statistics
    const duration = Date.now() - startTime;
    const contractsPerSecond = totalProcessed > 0 ? Math.round(totalProcessed / (duration / 1000)) : 0;

    if (this.onProgress) {
      this.onProgress({
        phase: 'completed',
        current: totalMethods,
        total: totalMethods,
        percentage: 100,
        message: 'Discovery completed!',
        stats: { discovered: totalDiscovered, processed: totalProcessed, added: totalAdded, errors: totalErrors }
      });
    }

    return {
      totalDiscovered,
      totalProcessed,
      totalAdded,
      totalErrors,
      batchesCompleted,
      duration,
      contractsPerSecond
    };
  }

  private async runSingleDiscovery(
    method: { type: string; name: string },
    config: DiscoveryOrchestrationConfig,
    current: number,
    total: number
  ): Promise<DiscoveryResult> {
    if (this.onProgress) {
      this.onProgress({
        phase: 'discovering',
        current: current - 1,
        total,
        percentage: Math.floor(((current - 1) / total) * 100),
        currentBatch: current,
        totalBatches: total,
        currentContract: method.name,
        message: `Discovering ${method.type}: ${method.name}...`
      });
    }

    try {
      // Create a single-method config for this discovery
      const singleMethodConfig: DiscoveryOrchestrationConfig = {
        traits: [],
        sipStandards: [],
        apiScan: { enabled: false, batchSize: 50, maxRetries: 3, retryDelay: 1000, timeout: 30000, blacklist: [] }
      };

      if (method.type === 'sip') {
        const sipConfig = config.sipStandards?.find(s => s.sipNumber === method.name);
        if (sipConfig) {
          singleMethodConfig.sipStandards = [sipConfig];
        }
      } else if (method.type === 'trait') {
        const traitConfig = config.traits?.find(t => t.trait.name === method.name);
        if (traitConfig) {
          singleMethodConfig.traits = [traitConfig];
        }
      }

      // Use the public discoverContracts method
      const result = await this.discoverContracts(singleMethodConfig);

      // Convert DiscoveryOrchestrationResult to DiscoveryResult format
      const firstResult = result.results[0];
      if (firstResult) {
        return firstResult;
      }

      // If no results, create an empty result
      return {
        success: true,
        method: 'manual-discovery' as any,
        timestamp: Date.now(),
        duration: result.duration,
        contractsFound: result.totalContractsFound,
        contractsProcessed: result.totalContractsProcessed,
        contractsAdded: result.totalContractsAdded,
        newContracts: [],
        errors: result.errors || []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        method: 'manual-discovery' as any,
        timestamp: Date.now(),
        duration: 0,
        contractsFound: 0,
        contractsProcessed: 0,
        contractsAdded: 0,
        newContracts: [],
        errors: [errorMessage]
      };
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎨 NFT CONTRACT DISCOVERY');
  console.log('='.repeat(60));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const dryRun = args.includes('--dry-run') || args.includes('--dry');
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50');
  const maxConcurrency = parseInt(args.find(arg => arg.startsWith('--concurrency='))?.split('=')[1] || '3');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx discover-nft-contracts.ts [options]

Options:
  --verbose, -v           Show detailed progress information
  --dry-run, --dry        Show discovery configuration without running
  --batch-size=<number>   Contracts per batch (default: 50)
  --concurrency=<number>  Max concurrent discovery batches (default: 3)
  --help, -h              Show this help message

Discovery Patterns:
  • SIP009 NFT standard contracts
  • Custom NFT mint functions
  • Token URI patterns
  • Collection info traits
`);
    process.exit(0);
  }

  try {
    console.log('⚙️ Initializing discovery engine...');

    // Initialize registry with discovery enabled
    const config = createDefaultConfig('mainnet-contract-registry');
    config.enableDiscovery = true;

    // Progress callback function
    const onProgress = (progress: ProgressInfo) => {
      const progressBar = createProgressBar(progress.current, progress.total);
      const phaseEmoji = {
        'setup': '⚙️',
        'discovering': '🔍',
        'processing': '⚡',
        'analyzing': '🔬',
        'completed': '✅'
      }[progress.phase];

      // Clear the current line and show progress
      process.stdout.write('\r\x1b[K');

      if (progress.phase === 'discovering' && progress.currentBatch) {
        const batchInfo = progress.totalBatches ? ` [${progress.currentBatch}/${progress.totalBatches}]` : '';
        const stats = progress.stats ? ` | Found: ${progress.stats.discovered}, Added: ${progress.stats.added}` : '';

        if (verbose && progress.currentContract) {
          process.stdout.write(`${progressBar} ${phaseEmoji} ${progress.currentContract}${batchInfo}${stats}\n`);
        } else {
          const contractShort = progress.currentContract?.split(' ')[0] || 'Working';
          process.stdout.write(`${progressBar} ${phaseEmoji} ${contractShort}${batchInfo}${stats}`);
        }
      } else {
        const message = progress.message || progress.phase;
        process.stdout.write(`${progressBar} ${phaseEmoji} ${message}`);
      }
    };

    const registry = new ConcurrentDiscoveryRegistry(config, onProgress);

    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No contracts will be discovered');
      console.log('');
    }

    console.log('🚀 Starting NFT contract discovery...');
    console.log(`   Batch size: ${batchSize} | Concurrency: ${maxConcurrency}`);
    console.log('');

    const stats = await registry.discoverNFTContracts({
      batchSize,
      maxConcurrency,
      includeSIP009: true,
      includeCustomTraits: true,
      dryRun
    });

    // Clear progress line and show final results
    process.stdout.write('\r\x1b[K');
    console.log('\n🎯 DISCOVERY RESULTS');
    console.log('='.repeat(60));
    console.log(`🔍 Total Discovered: ${stats.totalDiscovered}`);
    console.log(`⚡ Total Processed: ${stats.totalProcessed}`);
    console.log(`✅ Total Added: ${stats.totalAdded}`);
    console.log(`❌ Total Errors: ${stats.totalErrors}`);
    console.log(`📦 Batches Completed: ${stats.batchesCompleted}`);
    console.log(`⏱️  Duration: ${(stats.duration / 1000).toFixed(2)}s`);
    console.log(`🚀 Speed: ${stats.contractsPerSecond} contracts/sec`);

    if (stats.totalAdded > 0) {
      console.log(`\n🎨 Successfully discovered ${stats.totalAdded} new NFT contracts!`);
    } else if (!dryRun) {
      console.log(`\n📋 No new contracts discovered. Database may already be up to date.`);
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Discovery failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Discovery interrupted by user');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});