import OpenAI from 'openai';
import { Vault } from '@repo/dexterity';

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY || '';
if (!apiKey && process.env.NODE_ENV === 'development') {
    console.warn('⚠️ OPENAI_API_KEY not set. AI parsing will not work.');
}

const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: false,
});

/**
 * Use OpenAI o4-mini to parse and normalize token metadata
 * This function takes potentially inconsistent token data and returns a normalized structure
 */
export async function parseTokenMetadata(
    lpTokenData: any,
    tokenAData: any,
    tokenBData: any
): Promise<{
    normalizedLpToken: any;
    normalizedTokenA: any;
    normalizedTokenB: any;
    suggestedVault: Vault;
    analysis: string;
}> {
    try {
        // Clean and prepare the data before sending to OpenAI
        // Remove circular references and handle nested structures
        const prepareData = (data: any): any => {
            if (!data) return {};

            // Filter out circular references
            const cleaned = { ...data };
            // Remove any potential circular references like tokenA/tokenB from the LP token
            if (cleaned === lpTokenData) {
                delete cleaned.tokenA;
                delete cleaned.tokenB;
            }

            return cleaned;
        };

        // Convert the data objects to strings for the API with preparation
        const dataStr = JSON.stringify({
            lpToken: prepareData(lpTokenData),
            tokenA: prepareData(tokenAData),
            tokenB: prepareData(tokenBData)
        }, null, 2);

        // Create prompt for the LLM
        const response = await openai.chat.completions.create({
            model: 'o4-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a specialized AI that normalizes and parses token metadata for DEX vaults. 
                        Your task is to analyze LP token and its underlying tokens metadata, then produce a standardized format.
                        Focus on extracting and normalizing these fields:
                        - For LP tokens: name, symbol, decimals, identifier, description, image, fee (lpRebatePercent), externalPoolId, engineContractId
                        - For underlying tokens: name, symbol, decimals, contract_principal, identifier, description, image
                        
                        Construct a Vault object that follows this TypeScript interface:
                        export interface Vault {
                          contractId: string;
                          contractAddress: string;
                          contractName: string;
                          name: string;
                          symbol: string;
                          decimals: number;
                          identifier: string;
                          description: string;
                          image: string;
                          fee: number; // Expressed as (lpRebatePercent / 100) * 1_000_000
                          externalPoolId: string;
                          engineContractId: string;
                          tokenA: Token; // First underlying token
                          tokenB: Token; // Second underlying token
                          reservesA: number;
                          reservesB: number;
                        }
                        
                        You should calculate the fee from lpRebatePercent, if available, by: Math.floor((lpRebatePercent / 100) * 1_000_000)
                        Always make your best inference for missing fields, and explain your reasoning.`
                },
                {
                    role: 'user',
                    content: `Parse and normalize this token data for a DEX vault:
                    
                    ${dataStr}
                    
                    Return three formatted objects (normalizedLpToken, normalizedTokenA, normalizedTokenB), a suggested Vault object structure, and brief analysis of any fields you had to infer or fix.
                    
                    Format your response as valid JSON: 
                    {
                      "normalizedLpToken": {...},
                      "normalizedTokenA": {...},
                      "normalizedTokenB": {...},
                      "suggestedVault": {...},
                      "analysis": "Your analysis here"
                    }`
                }
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 2048,
        });

        // Parse and return the AI's response
        const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
        console.log('AI analysis of token data:', aiResponse.analysis);

        return aiResponse;
    } catch (error) {
        console.error('OpenAI parsing error:', error);

        // Fallback: return the original data with basic normalization
        const [contractAddress = '', contractName = ''] = (lpTokenData.contract_principal || lpTokenData.contractId || '').split('.');

        // Extract token contracts from various possible locations
        const tokenAContract = lpTokenData.tokenAContract ||
            (lpTokenData.properties?.tokenAContract) ||
            (lpTokenData.tokenA?.contractId) ||
            (lpTokenData.tokenA?.contract_principal) || '';

        const tokenBContract = lpTokenData.tokenBContract ||
            (lpTokenData.properties?.tokenBContract) ||
            (lpTokenData.tokenB?.contractId) ||
            (lpTokenData.tokenB?.contract_principal) || '';

        // Extract fee from various possible locations
        const feePercent = lpTokenData.lpRebatePercent ||
            (lpTokenData.properties?.lpRebatePercent) ||
            (lpTokenData.fee ? (lpTokenData.fee / 10000) : 0);

        const fee = feePercent ? Math.floor((Number(feePercent) / 100) * 1_000_000) : 0;

        // Enhance token data if needed
        const enhanceToken = (token: any) => {
            if (!token) return {};

            // Special handling for STX token
            if (token.contractId === '.stx' || token.contract_principal === '.stx') {
                return {
                    ...token,
                    name: token.name || 'Stacks',
                    symbol: token.symbol || 'STX',
                    decimals: token.decimals || 6,
                    contractId: '.stx',
                    contract_principal: '.stx',
                    identifier: token.identifier || 'stx',
                    image: token.image || 'https://charisma.rocks/stx-logo.png',
                    description: token.description || 'Native token of the Stacks blockchain'
                };
            }

            return {
                ...token,
                contractId: token.contractId || token.contract_principal || '',
                identifier: token.identifier || ''
            };
        };

        const enhancedTokenA = enhanceToken(tokenAData);
        const enhancedTokenB = enhanceToken(tokenBData);

        // Build a basic vault from the raw data
        const vault: Vault = {
            contractId: lpTokenData.contract_principal || lpTokenData.contractId || '',
            contractAddress,
            contractName,
            name: lpTokenData.name || 'Unknown LP Token',
            symbol: lpTokenData.symbol || 'LP',
            decimals: lpTokenData.decimals || 0,
            identifier: lpTokenData.identifier || '',
            description: lpTokenData.description || '',
            image: lpTokenData.image || '',
            fee,
            externalPoolId: lpTokenData.externalPoolId || lpTokenData.properties?.externalPoolId || '',
            engineContractId: lpTokenData.engineContractId || lpTokenData.properties?.engineContractId || '',
            tokenA: enhancedTokenA,
            tokenB: enhancedTokenB,
            reservesA: lpTokenData.reservesA || 0,
            reservesB: lpTokenData.reservesB || 0
        };

        return {
            normalizedLpToken: lpTokenData,
            normalizedTokenA: enhancedTokenA,
            normalizedTokenB: enhancedTokenB,
            suggestedVault: vault,
            analysis: 'Error using AI parsing, falling back to basic normalization'
        };
    }
} 