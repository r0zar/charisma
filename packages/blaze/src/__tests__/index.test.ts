import { describe, it, expect } from "@jest/globals";
import { createBlazeClient } from "..";
import { Cl } from "@stacks/transactions";

// Test/fake private key
const TEST_PRIVATE_KEY =
  'e494f188c2d35887531ba474c433b1e41fadd8eb824aca983447fd4bb8b277d801';

describe("@repo/blaze", () => {
  it("reads a contract", async () => {
    const client = createBlazeClient()
    const response = await client.call('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', 'get-total-supply')
    console.log(response);
    expect(response).toBeDefined();
  });

  it('writes a contract', async () => {
    const client = createBlazeClient({
      privateKey: TEST_PRIVATE_KEY,
      debug: true,
    });
    const mutateResult = await client.execute('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', 'transfer', [
      Cl.uint(1000),
      Cl.address('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G'),
      Cl.address('SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G'),
      Cl.none()
    ]);
    expect(mutateResult.error?.message).toContain('transaction rejected - NotEnoughFunds')
  });
});
