import { describe, it, expect, jest } from "@jest/globals";
import { fetchTokens, listPrices } from "..";

describe("@repo/tokens", () => {

  it('gets token prices', async () => {
    const prices = await listPrices();
    expect(prices).toBeDefined();
  });

  it('gets all tokens', async () => {
    const tokens = await fetchTokens();
    expect(tokens).toBeDefined();
    expect(Object.keys(tokens).length).toBeGreaterThan(0);
    console.log(tokens);
  });
});
