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
      .map((token) => new Token(token as any));
    console.log(tokenObjects.map((token) => token.contractId));
  });

  it('should data integrity check subnet tokens', async () => {
    const tokens = await listTokens();
    const tokenObjects = tokens
      .filter((token) => token.identifier)
      .filter((token) => token.contractId !== '.stx')
      .filter((token: any) => token.type === 'SUBNET')
      .map((token) => token.contractId);
    console.log(tokenObjects);
  });
});