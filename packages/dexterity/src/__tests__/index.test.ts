import { describe, it, expect } from "@jest/globals";
import {
  Router,
  defaultConfig,
  loadVaults,
  buildSwapTransaction,
  fetchQuote,
} from "../index";
import { CHARISMA_SUBNET_CONTRACT } from "@repo/tokens";

// quick helpers
const ROUTER_ADDR = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop";

describe("dexterity-sdk (live vaults)", () => {
  it("loads real vaults from dex-cache and prints graph stats", async () => {
    const router = new Router({ ...defaultConfig, debug: true });
    const vaults = await loadVaults(router);

    console.log("Loaded vaults →", vaults.length);
    const stats = router.stats();
    console.log("Graph stats →", stats);
    const vaultContractIds = router.vaultContractIds();
    console.log("Vault contract IDs →", vaultContractIds);
    const tokenContractIds = router.tokenContractIds();
    console.log("Token contract IDs →", tokenContractIds);

    expect(vaults.length).toBeGreaterThan(0);
    expect(stats.pools).toBe(vaults.length);
    expect(stats.tokens).toBeGreaterThan(0);
  });

  it("finds a route between two tokens in the first vault", async () => {
    const router = new Router({ ...defaultConfig, debug: true });
    const [first] = await loadVaults(router);

    const from = first.tokenA.contractId;
    const to = first.tokenB.contractId;

    const best = await router.findBestRoute(from, to, 1_000_000);
    console.log("Best route →", best);

    expect(!(best instanceof Error)).toBe(true);
    if (best instanceof Error) return;  // bail if something went wrong

    expect(best.hops.length).toBeGreaterThan(0);
    expect(best.amountOut).toBeGreaterThan(0);
  });

  it("builds a swap-transaction config (using first viable route)", async () => {
    const router = new Router({
      ...defaultConfig,
      routerContractId: ROUTER_ADDR,
      debug: true,
    });

    const [v] = await loadVaults(router);
    const route = await router.findBestRoute(
      v.tokenA.contractId,
      v.tokenB.contractId,
      500_000,
    );

    if (route instanceof Error) {
      console.warn("Route search failed:", route);
      expect(false).toBe(true); // force failure
      return;
    }

    const txCfg = await buildSwapTransaction(router, route, ROUTER_ADDR);
    console.log("Tx config →", {
      contract: txCfg.contract,
      fn: txCfg.functionName,
      args: txCfg.functionArgs.map((a) =>
        Buffer.isBuffer(a) ? a.toString("hex") : a
      ),
      postConditions: txCfg.postConditions.length,
    });

    expect(txCfg.functionArgs.length).toBe(route.hops.length + 1);
    expect(txCfg.postConditions.length).toBeGreaterThan(0);
  });

  it("fetches a quote from the API", async () => {
    const quote = await fetchQuote('.stx', CHARISMA_SUBNET_CONTRACT, 1_000_000);
    console.log("Quote →", quote);
    expect(quote).toBeDefined();
  });
});
