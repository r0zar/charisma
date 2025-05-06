import { describe, it, expect, jest } from "@jest/globals";
import { callReadOnlyFunction, getContractInterface, getContractInfo } from "../index";
import { cvToHex, principalCV } from "@stacks/transactions";

describe("getContractInterface", () => {
  it("should fetch the interface for a known contract (satoshibles)", async () => {
    // Using a known mainnet contract
    const contractAddress = "SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C";
    const contractName = "satoshibles";

    // Increase timeout for network request if needed
    // jest.setTimeout(10000); // 10 seconds

    try {
      const data = await getContractInterface(
        contractAddress,
        contractName
      );

      // Basic structure checks
      expect(data).toBeDefined();
      expect(Array.isArray(data.functions)).toBe(true);
      expect(Array.isArray(data.variables)).toBe(true);
      expect(Array.isArray(data.maps)).toBe(true);
      expect(Array.isArray(data.fungible_tokens)).toBe(true);
      expect(Array.isArray(data.non_fungible_tokens)).toBe(true);


    } catch (error) {
      // Fail the test if the API call throws an error
      // Optional: Log the error for debugging CI/network issues
      console.error("Integration test failed:", error);
      throw error; // Re-throw to ensure Jest marks the test as failed
    }
  }, 15000); // Increase timeout specifically for this test case
});

describe("callReadOnlyFunction", () => {
  it("should call a read-only function on a known contract (satoshibles)", async () => {
    const CONTRACT_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'
    const CONTRACT_NAME = 'yolo-efw'
    const functionName = "convert";

    const result = await callReadOnlyFunction(
      CONTRACT_ADDRESS,
      CONTRACT_NAME,
      functionName,
      [principalCV(CONTRACT_ADDRESS)]
    );
    console.log(result)
  });

  it('should get reserves quote', async () => {
    const result = await callReadOnlyFunction(
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
      'the-sneaky-link',
      'get-reserves-quote',
      []
    );
    console.log('result', result);
  })

  it('should get balance', async () => {
    const result = await callReadOnlyFunction(
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
      'charisma-token',
      'get-balance',
      [principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-sneaky-link')]
    );
    console.log('result', result);
  })
});

describe("getContractInfo", () => {
  it("should fetch info for a known contract (lp pool)", async () => {
    const contract_id = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-sneaky-link";

    try {
      const data = await getContractInfo(contract_id);

      console.log(data);

      expect(data).toBeDefined();
      expect(data).not.toBeNull();
      if (data) { // Type guard
        expect(typeof data.tx_id).toBe("string");
        expect(typeof data.canonical).toBe("boolean");
        expect(data.contract_id).toBe(contract_id);
        expect(typeof data.block_height).toBe("number");
        expect(typeof data.source_code).toBe("string");
        expect(typeof data.abi).toBe("string"); // ABI is a JSON string
      }
    } catch (error) {
      console.error("Integration test failed for getContractInfo (known contract):", error);
      throw error;
    }
  }, 15000);

  it("should return null for a non-existent contract", async () => {
    const contract_id = "SP000000000000000000002Q6VF78.this-contract-does-not-exist";
    // Mock console.warn to check if it's called
    const consoleWarnSpy = jest.spyOn(console, 'warn');

    try {
      const data = await getContractInfo(contract_id);
      expect(data).toBeNull();
      // Check if console.warn was called with the specific message
      expect(consoleWarnSpy).toHaveBeenCalledWith(`Contract not found: ${contract_id}`);
    } catch (error) {
      // This test expects a null return, not an error throw for 404s
      console.error("Integration test failed for getContractInfo (non-existent contract):", error);
      throw error;
    } finally {
      // Restore original console.warn
      consoleWarnSpy.mockRestore();
    }
  }, 15000);
});
