import { describe, it, expect, jest } from "@jest/globals";
import { listPrices } from "..";


describe("@repo/tokens", () => {

  it('gets token prices', async () => {
    const prices = await listPrices();
    expect(prices).toBeDefined();
  });
});
