import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { MetadataService, TokenMetadata } from '@/lib/metadata-service';
import { verifyMessageSignatureRsv } from '@stacks/encryption';
import { getAddressFromPublicKey, TransactionVersion } from '@stacks/transactions';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

interface GenerateMetadataRequest {
    name: string;
    symbol: string;
    decimals: number;
    identifier: string;
    description: string;
    properties?: Record<string, any>;
    imagePrompt?: string;
    customImageUrl?: string;
}

const isValidContractId = (contractId: string) => {
    return /^S[A-Z0-9]+\.[^\/]+$/.test(contractId);
};

// Helper to extract contract address from contract ID
const getContractAddress = (contractId: string) => {
    return contractId.split('.')[0];
};

export async function POST(
    request: NextRequest,
    { params }: { params: { contractId: string } }
) {
    const contractId = params.contractId;

    try {
        if (!isValidContractId(contractId)) {
            return NextResponse.json({ error: 'Invalid contract ID format' }, { status: 400 });
        }

        // Verify authentication for POST requests
        const signature = request.headers.get('x-signature');
        const publicKey = request.headers.get('x-public-key');
        const message = contractId;

        if (!signature || !publicKey) {
            return NextResponse.json({ error: 'Missing authentication headers' }, { status: 401 });
        }

        // Verify signature
        const isValid = verifyMessageSignatureRsv({ message, publicKey, signature });

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Get the address from the public key
        const signerAddress = getAddressFromPublicKey(publicKey, TransactionVersion.Mainnet);
        const contractAddress = getContractAddress(contractId);

        // Verify that signer owns the contract
        if (signerAddress !== contractAddress) {
            return NextResponse.json(
                { error: 'Not authorized to modify this contract metadata' },
                { status: 403 }
            );
        }

        const data = await request.json() as GenerateMetadataRequest;

        // If custom image URL provided, use it directly
        if (data.customImageUrl) {
            const metadata: TokenMetadata = {
                name: data.name,
                symbol: data.symbol,
                decimals: data.decimals,
                identifier: data.identifier,
                description: data.description,
                image: data.customImageUrl,
                properties: data.properties
            };

            const result = await MetadataService.set(contractId, metadata);
            return NextResponse.json(result);
        }

        // Otherwise generate image with AI
        const imagePrompt = data.imagePrompt ||
            `Design an iconic logo for ${data.name}, described by: ${data.description}`;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: imagePrompt,
            n: 1,
            size: "1024x1024",
            quality: 'standard',
            response_format: "url"
        });

        const imageUrl = response.data[0]?.url;

        if (!imageUrl) {
            return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
        }

        // Upload the generated image to Vercel Blob
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const blob = new Blob([imageBuffer]);
        const { url } = await put(`${contractId}-${Date.now()}.png`, blob, {
            access: 'public'
        });

        // Create and store metadata
        const metadata: TokenMetadata = {
            name: data.name,
            symbol: data.symbol,
            decimals: data.decimals,
            identifier: data.identifier,
            description: data.description,
            image: url,
            properties: data.properties
        };

        const result = await MetadataService.set(contractId, metadata);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to generate metadata:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate metadata';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: { contractId: string } }
) {
    const contractId = params.contractId;

    // For GET, we'll keep it unauthenticated to allow easy access to 
    // metadata generation capabilities for public contracts

    // ... rest of the function ...
}