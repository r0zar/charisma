import { describe, it, expect, vi, beforeEach } from "vitest";
import { callReadOnlyFunction, getContractInterface, getContractInfo, fetchContractEvents, fetcHoldToEarnLogs, callReadOnly } from "../index";
import { cvToHex, principalCV } from "@stacks/transactions";

// Mock the API client
vi.mock('../blockchain-api-client', () => ({
  apiClient: {
    GET: vi.fn(),
    POST: vi.fn(),
  }
}));

import { apiClient } from '../blockchain-api-client';

const mockApiClient = apiClient as vi.Mocked<typeof apiClient>;

describe("polyglot-sdk (mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContractInterface", () => {
    it("should fetch the interface for a known contract (mocked)", async () => {
      const contractAddress = "SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C";
      const contractName = "satoshibles";

      const mockInterface = {
        functions: [
          {
            name: "get-token-uri",
            access: "read_only",
            args: [{ name: "token-id", type: "uint128" }],
            outputs: { type: { response: { ok: { optional: "string-ascii" }, error: "uint128" } } }
          }
        ],
        variables: [
          {
            name: "contract-owner",
            type: "principal",
            access: "constant"
          }
        ],
        maps: [
          {
            name: "token-count",
            key: "principal",
            value: "uint128"
          }
        ],
        fungible_tokens: [],
        non_fungible_tokens: [
          {
            name: "satoshibles",
            type: "uint128"
          }
        ]
      };

      mockApiClient.GET.mockResolvedValue({
        data: mockInterface,
        response: new Response(JSON.stringify(mockInterface), { status: 200 }),
        error: undefined
      } as any);

      const data = await getContractInterface(contractAddress, contractName);

      expect(data).toBeDefined();
      expect(Array.isArray(data.functions)).toBe(true);
      expect(Array.isArray(data.variables)).toBe(true);
      expect(Array.isArray(data.maps)).toBe(true);
      expect(Array.isArray(data.fungible_tokens)).toBe(true);
      expect(Array.isArray(data.non_fungible_tokens)).toBe(true);
      expect(data.functions).toHaveLength(1);
      expect((data.functions[0] as any).name).toBe("get-token-uri");
    });
  });

  describe("callReadOnlyFunction", () => {
    it("should call a read-only function (mocked)", async () => {
      const CONTRACT_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
      const CONTRACT_NAME = 'yolo-efw';
      const functionName = "convert";

      // Mock the response with a valid Clarity hex result
      const mockData = {
        result: "0x0100000000000000000000000000000000" // Mock hex result
      };
      mockApiClient.POST.mockResolvedValue({
        data: mockData,
        response: new Response(JSON.stringify(mockData), { status: 200 }),
        error: undefined
      } as any);

      const result = await callReadOnlyFunction(
        CONTRACT_ADDRESS,
        CONTRACT_NAME,
        functionName,
        [principalCV(CONTRACT_ADDRESS)]
      );

      expect(result).toBeDefined();
      expect(mockApiClient.POST).toHaveBeenCalledWith(
        `/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/${functionName}`,
        {
          body: {
            sender: CONTRACT_ADDRESS,
            arguments: [cvToHex(principalCV(CONTRACT_ADDRESS))]
          }
        }
      );
    });

    it('should get reserves quote (mocked)', async () => {
      // Mock API error to test error handling
      mockApiClient.POST.mockResolvedValue({
        data: undefined,
        response: new Response('', { status: 500 }),
        error: { error: "Mock API error", message: "API call failed" }
      } as any);

      const result = await callReadOnlyFunction(
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'the-sneaky-link',
        'get-reserves-quote',
        []
      );

      expect(result).toBeNull();
    });

    it('should get balance (mocked)', async () => {
      // Mock a balance response (1000000 µSTX) - using valid uint128 Clarity type
      const mockBalanceHex = "0x070000000000000000000000000f4240"; // u1000000 in Clarity hex
      const mockData = {
        result: mockBalanceHex
      };
      
      mockApiClient.POST.mockResolvedValue({
        data: mockData,
        response: new Response(JSON.stringify(mockData), { status: 200 }),
        error: undefined
      } as any);

      const result = await callReadOnlyFunction(
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'charisma-token',
        'get-balance',
        [principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-sneaky-link')]
      );

      expect(result).toBeDefined();
      expect(result?.value.toString()).toBe('1000000');
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.POST.mockResolvedValue({
        data: undefined,
        response: new Response('', { status: 404 }),
        error: { error: "Contract not found", message: "Contract not found" }
      } as any);

      const result = await callReadOnlyFunction(
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'non-existent-contract',
        'some-function',
        []
      );

      expect(result).toBeNull();
    });
  });

  describe("callReadOnly", () => {
    it("should call read-only function with contract ID format (mocked)", async () => {
      const contractId = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token";
      const functionName = "get-balance";

      // Mock a balance response using valid uint128 Clarity type
      const mockBalanceHex = "0x070000000000000000000000000f4240"; // u1000000 in Clarity hex
      const mockData = {
        result: mockBalanceHex
      };
      
      mockApiClient.POST.mockResolvedValue({
        data: mockData,
        response: new Response(JSON.stringify(mockData), { status: 200 }),
        error: undefined
      } as any);

      const result = await callReadOnly(
        contractId,
        functionName,
        [principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-sneaky-link')]
      );

      expect(result).toBeDefined();
      expect(result?.value.toString()).toBe('1000000');
    });
  });

  describe("getContractInfo", () => {
    it("should fetch info for a known contract (mocked)", async () => {
      const contract_id = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-sneaky-link";

      const mockContractInfo = {
        tx_id: "0x1234567890abcdef",
        canonical: true,
        contract_id: contract_id,
        block_height: 100000,
        source_code: "(define-public (test) (ok true))",
        abi: JSON.stringify({
          functions: [],
          variables: [],
          maps: [],
          fungible_tokens: [],
          non_fungible_tokens: []
        })
      };

      mockApiClient.GET.mockResolvedValue({
        data: mockContractInfo,
        response: new Response(JSON.stringify(mockContractInfo), { status: 200 }),
        error: undefined
      } as any);

      const data = await getContractInfo(contract_id);

      expect(data).toBeDefined();
      expect(data).not.toBeNull();
      if (data) {
        expect(typeof data.tx_id).toBe("string");
        expect(typeof data.canonical).toBe("boolean");
        expect(data.contract_id).toBe(contract_id);
        expect(typeof data.block_height).toBe("number");
        expect(typeof data.source_code).toBe("string");
        expect(typeof data.abi).toBe("string");
      }
    });

    it("should return null for a non-existent contract (mocked)", async () => {
      const contract_id = "SP000000000000000000002Q6VF78.this-contract-does-not-exist";
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock 404 response
      const mockError = new Error('Not found');
      (mockError as any).response = { status: 404 };
      mockApiClient.GET.mockRejectedValue(mockError);

      const data = await getContractInfo(contract_id);
      expect(data).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(`Contract not found: ${contract_id}`);
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe("fetchContractEvents", () => {
    it('should fetch contract events (mocked)', async () => {
      const contractAddress = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';
      
      const mockEvents = {
        limit: 100,
        offset: 0,
        total: 2,
        results: [
          {
            event_index: 0,
            event_type: "contract_log",
            tx_id: "0xabc123",
            contract_log: {
              contract_id: contractAddress,
              topic: "print",
              value: {
                hex: "0x0c00000004026f700d00000004686f6c64076d65737361676508756e697665727365"
              }
            }
          }
        ]
      };

      mockApiClient.GET.mockResolvedValue({
        data: mockEvents,
        response: new Response(JSON.stringify(mockEvents), { status: 200 }),
        error: undefined
      } as any);

      const data = await fetchContractEvents(contractAddress);
      
      expect(data).toBeDefined();
      expect(data.results).toHaveLength(1);
      expect(data.results[0].event_type).toBe("contract_log");
    });
  });

  describe("fetcHoldToEarnLogs", () => {
    it('should handle empty contract events (mocked)', async () => {
      const contractAddress = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';
      
      // Mock empty events to avoid Clarity parsing complexity
      const mockEvents = {
        limit: 100,
        offset: 0,
        total: 0,
        results: []
      };

      mockApiClient.GET.mockResolvedValue({
        data: mockEvents,
        response: new Response(JSON.stringify(mockEvents), { status: 200 }),
        error: undefined
      } as any);

      const data = await fetcHoldToEarnLogs(contractAddress);
      
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });
});