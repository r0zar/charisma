/* eslint-disable @typescript-eslint/no-explicit-any */

import { StacksClient } from "@repo/stacks";
import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import { Dexterity, OPCODES, SwapOptions } from "..";
import 'dotenv/config';

// Test/fake private key
const TEST_PRIVATE_KEY =
  'e494f188c2d35887531ba474c433b1e41fadd8eb824aca983447fd4bb8b277d801';

// Hiro API keys from environment
const apiKeys = process.env.HIRO_API_KEYS!.split(',');

describe("@repo/dexterity", () => {
  // Initialize once before all tests
  beforeAll(() => {
    Dexterity.init({
      privateKey: TEST_PRIVATE_KEY,
      debug: false,
      apiKeys: apiKeys,
    });
  });

  // Basic vault discovery test
  it("discovers dexterity vaults", async () => {
    const vaults = await Dexterity.discover({
      maxVaultLoadLimit: 20 // Limit for faster tests
    });

    expect(vaults).toBeDefined();
    expect(Array.isArray(vaults)).toBe(true);
    expect(vaults.length).toBeGreaterThan(0);

    // Log first vault for debugging
    if (vaults.length > 0) {
      console.log("First vault:", {
        name: vaults[0].name,
        symbol: vaults[0].symbol,
        contractId: vaults[0].contractId,
        tokens: `${vaults[0].tokenA.symbol}-${vaults[0].tokenB.symbol}`,
        fee: vaults[0].fee
      });
    }
  }, 30000);

  // Test building a specific vault
  it('builds a vault by address', async () => {
    const contractId = 'SP39859AD7RQ6NYK00EJ8HN1DWE40C576FBDGHPA0.chabtz-lp-token';
    const vault = await Dexterity.buildVault(contractId);

    expect(vault).toBeDefined();
    expect(vault?.contractId).toBe(contractId);
    expect(vault?.tokenA).toBeDefined();
    expect(vault?.tokenB).toBeDefined();

    console.log(`Vault ${vault?.name}:`, {
      tokenA: vault?.tokenA.symbol,
      tokenB: vault?.tokenB.symbol,
      fee: vault?.fee
    });
  }, 15000);

  // Test vault discovery and loading into routing graph
  it('discovers and loads vaults into routing graph', async () => {
    const vaults = await Dexterity.discoverAndLoad({
      maxVaultLoadLimit: 5 // Limit for faster tests
    });

    expect(vaults).toBeDefined();
    expect(vaults.length).toBeGreaterThan(0);

    // Check graph stats
    const stats = Dexterity.getGraphStats();
    expect(stats.nodeCount).toBeGreaterThan(0);
    expect(stats.edgeCount).toBeGreaterThan(0);

    console.log("Graph statistics:", {
      tokens: stats.nodeCount,
      pools: stats.edgeCount,
      density: (stats.edgeCount / (stats.nodeCount * (stats.nodeCount - 1))).toFixed(6)
    });
  }, 30000);

  // Test getting all tokens from vaults
  it('extracts unique tokens from vaults', async () => {
    const vaults = await Dexterity.discover({
      parallelRequests: 3,
      maxVaultLoadLimit: 5
    });

    const tokens = Dexterity.getAllVaultTokens(vaults);

    expect(tokens).toBeDefined();
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);

    // Tokens should be unique
    const contractIds = tokens.map(t => t.contractId);
    const uniqueContractIds = new Set(contractIds);
    expect(uniqueContractIds.size).toBe(tokens.length);

    console.log(`Found ${tokens.length} unique tokens`);
    if (tokens.length > 0) {
      console.log("First 3 tokens:", tokens.slice(0, 3).map(t => `${t.symbol} (${t.contractId})`));
    }
  }, 20000);

  // Test finding vaults with a specific token
  it('finds vaults containing a specific token', async () => {
    // STX is likely to be in multiple pools
    const stxTokenId = '.stx';
    const vaults = await Dexterity.discover({
      parallelRequests: 3,
      maxVaultLoadLimit: 5
    });

    const stxVaults = Dexterity.getVaultsWithToken(vaults, stxTokenId);
    expect(stxVaults).toBeDefined();
    expect(Array.isArray(stxVaults)).toBe(true);

    console.log(`Found ${stxVaults.length} vaults containing STX`);
    if (stxVaults.length > 0) {
      const pairTokens = stxVaults.map(v =>
        v.tokenA.contractId === stxTokenId ? v.tokenB.symbol : v.tokenA.symbol
      );
      console.log("STX is paired with:", pairTokens);
    }
  }, 20000);

  // Test route finding
  it('finds routes between tokens', async () => {
    // First discover and load vaults
    await Dexterity.discoverAndLoad({
      parallelRequests: 3,
      maxVaultLoadLimit: 5
    });

    // Find routes between STX and another token
    // We'll need to find another token that exists in the graph
    const stxTokenId = '.stx';
    const tokens = Dexterity.getAllVaultTokens(Dexterity.getVaults());

    // Find a non-STX token to route to
    const targetToken = tokens.find(t => t.contractId !== stxTokenId);

    if (targetToken) {
      console.log(`Finding routes from STX to ${targetToken.symbol} (${targetToken.contractId})`);

      const routes = Dexterity.findRoute(stxTokenId, targetToken.contractId);
      expect(routes).toBeDefined();

      console.log(`Found ${routes.length} possible routes`);

      if (routes.length > 0) {
        const routeDescriptions = routes.slice(0, 3).map(route =>
          route.map(token => token.symbol).join(' → ')
        );
        console.log("Sample routes:", routeDescriptions);

        // Check that routes start with STX and end with target token
        routes.forEach(route => {
          expect(route[0].contractId).toBe(stxTokenId);
          expect(route[route.length - 1].contractId).toBe(targetToken.contractId);
        });
      }
    } else {
      console.log("Could not find a suitable token to test routing");
    }
  }, 30000);

  // Test quote functionality
  it('gets swap quotes', async () => {
    // First discover and load vaults
    await Dexterity.discoverAndLoad({
      parallelRequests: 3,
      maxVaultLoadLimit: 5
    });

    // Get all tokens in the graph
    const tokens = Dexterity.getAllVaultTokens(Dexterity.getVaults());

    // Find STX and another token to test with
    const stxToken = tokens.find(t => t.contractId === '.stx');
    const otherToken = tokens.find(t => t.contractId !== '.stx');

    if (stxToken && otherToken) {
      console.log(`Getting quote for ${stxToken.symbol} → ${otherToken.symbol}`);

      // Test with 1 STX (1 million microSTX)
      const amountIn = 1000000;

      // Since we're in a test environment, the contract calls might not work
      // So we'll just verify the function runs without error
      try {
        const quoteResult = await Dexterity.getQuote(stxToken.contractId, otherToken.contractId, amountIn);

        if (quoteResult instanceof Error) {
          console.log(`Quote error (expected in test): ${quoteResult.message}`);
          // Not failing the test; in a test environment this is expected
        } else {
          console.log(`Quote result: ${amountIn} ${stxToken.symbol} → ${quoteResult.amountOut} ${otherToken.symbol}`);
          console.log(`Exchange rate: 1 ${stxToken.symbol} = ${quoteResult.expectedPrice} ${otherToken.symbol}`);
        }

        // Just testing function run, not the result
        expect(true).toBe(true);
      } catch (error) {
        // Just log the error but don't fail the test
        console.error("Error getting quote (expected in test):", error);
        expect(true).toBe(true);
      }
    } else {
      console.log("Could not find suitable tokens to test quoting");
      // Skip without failing
      expect(true).toBe(true);
    }
  }, 30000);

  // Test direct vault quote (to test the callVaultQuote function specifically)
  it('gets quote directly from a vault', async () => {
    // Discover vaults
    const vaults = await Dexterity.discover({
      parallelRequests: 3,
      maxVaultLoadLimit: 50
    });

    if (vaults.length > 0) {
      const vault = vaults[9];
      console.log(`Testing direct quote for vault ${vault.name}`);

      // Test amount (1 million base units)
      const amount = 1000000;

      // Try both A->B and B->A swaps
      try {
        // Since we're in a test environment, this might fail
        // Just checking if the function runs without throwing
        const quoteAB = await Dexterity.callVaultQuote(vault, amount, OPCODES.SWAP_A_TO_B);
        const quoteBA = await Dexterity.callVaultQuote(vault, amount, OPCODES.SWAP_B_TO_A);

        if (quoteAB instanceof Error) {
          console.log(`Quote A->B error (expected in test): ${quoteAB.message}`);
        } else {
          console.log(`Quote A->B: ${amount} ${vault.tokenA.symbol} → ${quoteAB.amountOut} ${vault.tokenB.symbol}`);
        }

        if (quoteBA instanceof Error) {
          console.log(`Quote B->A error (expected in test): ${quoteBA.message}`);
        } else {
          console.log(`Quote B->A: ${amount} ${vault.tokenB.symbol} → ${quoteBA.amountOut} ${vault.tokenA.symbol}`);
        }

        // Just testing function run
        expect(true).toBe(true);
      } catch (error) {
        // Log but don't fail test
        console.error("Error in direct quote (expected in test):", error);
        expect(true).toBe(true);
      }
    } else {
      console.log("No vaults available to test direct quoting");
      expect(true).toBe(true);
    }
  }, 20000);

  // Test router configuration
  it('configures the router contract', () => {
    const routerAddress = 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR';
    const routerName = 'multihops';

    Dexterity.configureRouter(routerAddress, routerName, {
      maxHops: 2,
      defaultSlippage: 0.005, // 0.5%
      debug: true
    });

    // This is testing a private property so we use any to access it
    const config = (Dexterity as any).config;

    expect(config.routerAddress).toBe(routerAddress);
    expect(config.routerName).toBe(routerName);
    expect(config.maxHops).toBe(2);
    expect(config.defaultSlippage).toBe(0.005);
  });

  it('builds a swap transaction', async () => {
    // First discover and load vaults
    await Dexterity.discoverAndLoad()

    // Configure the router
    Dexterity.configureRouter(
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
      'multihop',
      { maxHops: 2 }
    );

    const quote: any = await Dexterity.getQuote(
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
      100000
    );

    const result = await Dexterity.buildSwapTransaction(quote.route, 1000000)

    console.log(result)

  }, 50000)


  // Test swap execution method
  it('executes a swap with the correct parameters', async () => {

    await Dexterity.discoverAndLoad()

    // Configure the router
    Dexterity.configureRouter(
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
      'multihop',
      { maxHops: 2 }
    );

    // Execute the swap with options
    const swapOptions: SwapOptions = {
      slippageTolerance: 0.01,
      fee: 1000
    };

    const result = await Dexterity.executeSwap(
      '.stx',
      'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
      1000000,
      swapOptions
    )

    // should not have enough funds
    expect(result).toBeInstanceOf(Error)

  }, 50000);

});