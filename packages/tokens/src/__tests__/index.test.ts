import { describe, it, expect, jest, test } from "@jest/globals";
import { listPrices, listTokens, Token } from "..";

describe("@repo/tokens", () => {

  it('gets token prices', async () => {
    const prices = await listPrices();
    expect(prices).toBeDefined();
  });

});


describe('Token Cache', () => {
  it('should list tokens add create Token objects', async () => {
    const tokens = await listTokens();
    expect(tokens).toBeDefined();
    expect(tokens.length).toBeGreaterThan(0);
    // create Token objects
    const tokenObjects = tokens
      .filter((token) => token.identifier)
      .filter((token) => token.contractId !== '.stx')
      .map((token) => new Token(token));
    console.log(tokenObjects.map((token) => token.contractId));
  });
});