import { describe, it, expect } from "@jest/globals";
import { callReadOnlyFunction, getContractInterface } from "../index";
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
