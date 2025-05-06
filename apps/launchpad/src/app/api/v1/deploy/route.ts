import { NextRequest, NextResponse } from 'next/server';
import { getAddressFromPrivateKey, getAddressFromPublicKey, makeContractDeploy, PostConditionMode } from '@stacks/transactions';
import { z } from 'zod';

// Define the expected payload for LP deployment
const StacksContractAddressRegex = /^S[A-Z0-9]+\.[a-zA-Z0-9-]+$/;
const PositiveIntegerStringRegex = /^\d+$/;

const LPPropertiesSchema = z.object({
    tokenAContract: z.string().regex(StacksContractAddressRegex, "Invalid Stacks contract address format for Token A"),
    tokenBContract: z.string().regex(StacksContractAddressRegex, "Invalid Stacks contract address format for Token B"),
    swapFeePercent: z.number().min(0).optional(), // e.g., 1 for 1%, 0.1 for 0.1%
    initialLiquidityTokenA: z.string().regex(PositiveIntegerStringRegex, "Initial liquidity for Token A must be a positive integer string (atomic units)"),
    initialLiquidityTokenB: z.string().regex(PositiveIntegerStringRegex, "Initial liquidity for Token B must be a positive integer string (atomic units)"),
    // Allow other properties as well
}).passthrough();

const LPDeployPayloadSchema = z.object({
    name: z.string().min(1, "LP Token Name is required"),
    symbol: z.string().min(1).max(10, "LP Token Symbol must be 1-10 characters"),
    decimals: z.number().int().min(0).max(18, "LP Token Decimals must be between 0 and 18"),
    identifier: z.string().min(1, "Identifier is required"), // Often same as symbol for LPs
    description: z.string().optional(),
    image: z.string().url("Image must be a valid URL").optional(),
    properties: LPPropertiesSchema,
});

type LPDeployPayload = z.infer<typeof LPDeployPayloadSchema>;

// Helper for CORS headers (can be moved to a shared lib later)
function generateCorsHeaders(request: NextRequest, methods: string) {
    const headers = new Headers();
    const origin = request.headers.get('Origin');
    // For now, allow any origin, but you might want to restrict this in production
    if (origin) {
        headers.set('Access-Control-Allow-Origin', origin);
    }
    headers.set('Access-Control-Allow-Methods', methods);
    headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key'); // Add x-api-key
    headers.set('Access-Control-Allow-Credentials', 'true');
    return headers;
}

export async function POST(request: NextRequest) {
    const corsHeaders = generateCorsHeaders(request, 'POST');
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.LAUNCHPAD_API_KEY;

    if (!expectedApiKey) {
        console.error('LAUNCHPAD_API_KEY is not set in environment variables.');
        return NextResponse.json({ error: 'Service configuration error' }, { status: 500, headers: corsHeaders });
    }

    if (!apiKey || apiKey !== expectedApiKey) {
        return NextResponse.json({ error: 'Unauthorized: Invalid or missing API key' }, { status: 401, headers: corsHeaders });
    }

    let payload: LPDeployPayload;
    try {
        const rawPayload = await request.json();
        payload = LPDeployPayloadSchema.parse(rawPayload);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request payload', details: error.errors }, { status: 400, headers: corsHeaders });
        }
        return NextResponse.json({ error: 'Failed to parse request body' }, { status: 400, headers: corsHeaders });
    }

    try {
        // 1. Prepare for and call the metadata API
        const launchpadDeployerAddress = process.env.LAUNCHPAD_DEPLOYER_ADDRESS;
        const metadataServiceApiKey = process.env.METADATA_API_KEY; // Key for calling metadata service

        if (!launchpadDeployerAddress) {
            console.error('LAUNCHPAD_DEPLOYER_ADDRESS environment variable is not set.');
            return NextResponse.json({ error: 'Service configuration error: Deployer address missing' }, { status: 500, headers: corsHeaders });
        }
        if (!metadataServiceApiKey) {
            console.error('METADATA_API_KEY environment variable is not set (for calling metadata service).');
            return NextResponse.json({ error: 'Service configuration error: Metadata API key missing' }, { status: 500, headers: corsHeaders });
        }

        // Construct the contractId for the new LP token.
        // Assuming payload.identifier is the unique contract name (e.g., "my-lp-token").
        const lpContractName = payload.identifier;
        const lpContractIdForMetadata = `${launchpadDeployerAddress}.${lpContractName}`;

        // Prepare the metadata payload to send to the metadata service.
        // This structure should align with what the metadata service's POST /api/v1/metadata/[contractId] expects (TokenMetadata).
        const metadataToPost = {
            name: payload.name,
            symbol: payload.symbol,
            decimals: payload.decimals,
            identifier: payload.identifier, // The 'identifier' field for the metadata object itself
            description: payload.description,
            image: payload.image,
            properties: payload.properties, // payload.properties is of LPPropertiesSchema, which includes liquidity info.
            // Metadata service's PropertiesSchema has .passthrough()
        };

        const metadataApiUrl = `https://metadata.charisma.rocks/api/v1/metadata/${lpContractIdForMetadata}`;
        console.log(`Calling metadata API to set/update metadata: POST ${metadataApiUrl}`);

        const metadataResponse = await fetch(metadataApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': metadataServiceApiKey,
            },
            body: JSON.stringify(metadataToPost),
        });

        if (!metadataResponse.ok) {
            const errorBodyText = await metadataResponse.text().catch(() => 'Could not read error body');
            console.error(`Metadata API call failed: ${metadataResponse.status} ${metadataResponse.statusText}`, errorBodyText);
            return NextResponse.json({
                error: 'Failed to create/update metadata for the LP token',
                details: `Metadata service responded with ${metadataResponse.status}: ${errorBodyText}`
            }, { status: metadataResponse.status >= 400 && metadataResponse.status < 500 ? metadataResponse.status : 502, headers: corsHeaders }); // 502 for bad gateway if metadata service fails unexpectedly
        }

        const metadataResult = await metadataResponse.json();
        console.log('Metadata API call successful:', metadataResult);

        // TODO: Implement the actual LP deployment logic here.
        // This might involve:
        // 1. Using the lpContractIdForMetadata (or parts of it) for deployment.
        // 2. Validating token contracts on-chain.
        // 3. Interacting with a factory contract to deploy the LP.
        // 4. Storing deployment details.
        // 5. Returning transaction IDs or LP contract details.

        console.log('Received LP deployment request:', payload);

        const deployerPrivateKey = process.env.LAUNCHPAD_DEPLOYER_PRIVATE_KEY;
        if (!deployerPrivateKey) {
            console.error('LAUNCHPAD_DEPLOYER_PRIVATE_KEY environment variable is not set.');
            return NextResponse.json({ error: 'Service configuration error: Deployer private key missing' }, { status: 500, headers: corsHeaders });
        }

        const deployerPublicKey = getAddressFromPrivateKey(deployerPrivateKey);
        const deployerAddress = getAddressFromPublicKey(deployerPublicKey);

        const poolCodeBody = `(define-public (hello (name (string-ascii 10))) (ok (concat "hello " name)))`

        const txOptions = {
            clarityVersion: 3,
            contractName: lpContractIdForMetadata,
            codeBody: poolCodeBody,
            fee: 10000,
            postConditionMode: PostConditionMode.Deny,
            postConditions: [],
            senderKey: deployerPrivateKey
        }

        const deployTxResult = await makeContractDeploy(txOptions)

        console.log('Deploy transaction result:', deployTxResult);

        // Placeholder response
        return NextResponse.json({
            success: true,
            message: 'LP metadata created/updated. Deployment request received and validated. Further processing pending.',
            data: payload,
            metadataServiceResponse: metadataResult,
            deployedLpContractIdHint: lpContractIdForMetadata
        }, { status: 202, headers: corsHeaders }); // 202 Accepted indicates processing has started

    } catch (error) {
        console.error('Error during LP deployment processing:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'LP deployment failed', details: errorMessage }, { status: 500, headers: corsHeaders });
    }
}

export async function OPTIONS(request: NextRequest) {
    const headers = generateCorsHeaders(request, 'POST, OPTIONS');
    headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    return new NextResponse(null, { status: 204, headers });
} 