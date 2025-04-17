import { describe, it, expect } from "@jest/globals";
import { StacksClient } from "..";
import { Cl } from "@stacks/transactions";

// Test/fake private key
const TEST_PRIVATE_KEY =
  'e494f188c2d35887531ba474c433b1e41fadd8eb824aca983447fd4bb8b277d801';

describe("@repo/stacks", () => {
  it("reads a contract", async () => {
    const instance = StacksClient.getInstance();
    const response = await instance.callReadOnly('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', 'get-total-supply')
    console.log(response);
    expect(response).toBeDefined();
  });

  it('writes a contract', async () => {
    const instance = StacksClient.getInstance({
      privateKey: TEST_PRIVATE_KEY,
    });
    const result = await instance.callContractFunction('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', 'transfer', [
      Cl.uint(1000),
      Cl.address('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G'),
      Cl.address('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G'),
      Cl.none()
    ]);

    // should not have enough funds
    expect(result).toBeInstanceOf(Error)
    if (result instanceof Error) {
      expect(result.message).toContain('transaction rejected - NotEnoughFunds');
    }
  });
});
