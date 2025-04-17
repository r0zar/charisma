import { describe, it, expect, beforeAll } from "@jest/globals";
import { Cryptonomicon } from "..";

// Hiro API keys
const apiKeys = process.env.HIRO_API_KEYS!.split(',');

describe("@repo/cryptonomicon", () => {
  const client = new Cryptonomicon({
    debug: true,
    apiKeys: apiKeys,
  })
  it("setup metadata client", async () => {
    console.log(client)
  });

  it("reads a contract (welsh)", async () => {
    const tokenResponse = await client.getTokenMetadata('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token')
    console.log(tokenResponse);
    expect(tokenResponse).toBeDefined();
  })

  it("reads a contract (charisma)", async () => {
    const tokenResponse = await client.getTokenMetadata('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token')
    console.log(tokenResponse);
    expect(tokenResponse).toBeDefined();
  })

  it("reads a LP contract (POV)", async () => {
    const tokenResponse = await client.getTokenMetadata('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit')
    console.log(tokenResponse);
    expect(tokenResponse).toBeDefined();
  })

  it("reads a LP contract (CHABTZ)", async () => {
    const tokenResponse = await client.getTokenMetadata('SP39859AD7RQ6NYK00EJ8HN1DWE40C576FBDGHPA0.chabtz-lp-token')
    console.log(tokenResponse);
    expect(tokenResponse).toBeDefined();
  })

  it('gets token URI (cha)', async () => {
    const tokenURIResponse = await client.getTokenUri('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token')
    console.log(tokenURIResponse);
    expect(tokenURIResponse).toBeDefined();
  })

  it('gets token URI (POV)', async () => {
    const tokenURIResponse = await client.getTokenUri('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit')
    console.log(tokenURIResponse);
    expect(tokenURIResponse).toBeDefined();
  })

});
