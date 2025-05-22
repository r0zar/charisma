import { describe, it, expect, jest, test } from "@jest/globals";
import { fetchMetadata, listPrices, listTokens, Token } from "..";

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
    const metadataList = await fetchMetadata();
    const metadata = metadataList
      .filter((metadata: any) => metadata.type === 'SUBNET')
      .map((metadata) => metadata.contractId);
    console.log(metadata);
  });


  it('should data integrity check sublinks', async () => {
    const metadataList = await fetchMetadata();
    const metadata = metadataList
      .filter((metadata: any) => metadata.type === 'SUBLINK')
      .map((metadata) => metadata.contractId);
    console.log(metadata);
  });
});