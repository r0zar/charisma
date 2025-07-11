import { makeContractCall, broadcastTransaction } from '@stacks/transactions';

export interface ContractCallArgs {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs?: any[];
  postConditionMode?: 'allow' | 'deny';
}

export interface ContractCallResult {
  success: boolean;
  txid?: string;
  result?: any;
  error?: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
}

export interface BotCredentials {
  privateKey: string;
}

export class ContractCaller {
  constructor(private credentials: BotCredentials) {}

  /**
   * Make a contract call with the specified parameters
   */
  async makeContractCall(args: ContractCallArgs): Promise<ContractCallResult> {
    const {
      contractAddress,
      contractName,
      functionName,
      functionArgs = [],
      postConditionMode = 'allow'
    } = args;

    try {
      console.log(`Contract Call: ${contractName}.${functionName}...`);
      
      const transaction = await makeContractCall({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        postConditionMode,
        senderKey: this.credentials.privateKey
      });
      
      const result = await broadcastTransaction({ transaction });
      
      console.log(`Contract Call: Successfully initiated TxID: ${result.txid}`);
      
      return {
        success: true,
        txid: result.txid,
        result,
        contractAddress,
        contractName,
        functionName
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Contract call error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        contractAddress,
        contractName,
        functionName
      };
    }
  }

  /**
   * Simplified contract call with positional arguments
   */
  async call(
    contractAddress: string,
    contractName: string,
    functionName: string,
    functionArgs: any[] = []
  ): Promise<ContractCallResult> {
    return this.makeContractCall({
      contractAddress,
      contractName,
      functionName,
      functionArgs
    });
  }

  /**
   * Execute the original hoot-farmer contract call for backward compatibility
   */
  async hootFarmer(): Promise<ContractCallResult> {
    return this.call(
      'SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE',
      'powerful-farmer',
      'execute-both'
    );
  }
}

/**
 * Create a contract caller instance with bot credentials
 */
export function createContractCaller(credentials: BotCredentials): ContractCaller {
  return new ContractCaller(credentials);
}

/**
 * Functional API for simple contract calls
 */
export async function callContract(
  credentials: BotCredentials,
  contractAddress: string,
  contractName: string,
  functionName: string,
  functionArgs: any[] = []
): Promise<ContractCallResult> {
  const caller = createContractCaller(credentials);
  return caller.call(contractAddress, contractName, functionName, functionArgs);
}