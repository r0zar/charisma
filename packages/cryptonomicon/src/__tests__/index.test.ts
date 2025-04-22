import { describe, it, expect, beforeAll } from "@jest/globals";
import { Cryptonomicon } from "..";

// Hiro API keys
const apiKey = process.env.HIRO_API_KEY

/**
 * Default pool trait for contract discovery
 */
const POOL_TRAIT = {
  maps: [],
  epoch: "Epoch30",
  functions: [
    {
      args: [
        { name: "amount", type: "uint128" },
        {
          name: "opcode",
          type: { optional: { buffer: { length: 16 } } }
        }
      ],
      name: "execute",
      access: "public",
      outputs: {
        type: {
          response: {
            ok: {
              tuple: [
                { name: "dk", type: "uint128" },
                { name: "dx", type: "uint128" },
                { name: "dy", type: "uint128" }
              ]
            },
            error: "uint128"
          }
        }
      }
    },
    {
      args: [
        { name: "amount", type: "uint128" },
        {
          name: "opcode",
          type: { optional: { buffer: { length: 16 } } }
        }
      ],
      name: "quote",
      access: "read_only",
      outputs: {
        type: {
          response: {
            ok: {
              tuple: [
                { name: "dk", type: "uint128" },
                { name: "dx", type: "uint128" },
                { name: "dy", type: "uint128" }
              ]
            },
            error: "uint128"
          }
        }
      }
    }
  ],
  variables: [],
  clarity_version: "Clarity3",
  fungible_tokens: [],
  non_fungible_tokens: []
};

describe("@repo/cryptonomicon", () => {
  const client = new Cryptonomicon({
    debug: true,
    apiKey: apiKey,
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

  it('get all dexterity vaults', async () => {
    const contracts = await client.searchContractsByTrait(POOL_TRAIT);
    console.log(contracts);
    expect(contracts).toBeDefined();
  })

});
