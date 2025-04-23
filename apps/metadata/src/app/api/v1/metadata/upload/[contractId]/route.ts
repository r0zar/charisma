import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { MetadataService } from '@/lib/metadata-service';
import { kv } from '@vercel/kv';
import { generateCorsHeaders } from '@/lib/cors-helper';

type Context = {
    params: { contractId: string };
};

type BlobResponse = {
    url: string;
    pathname: string;
};

// Delete old blobs
async function deleteOldBlobIfExists(contractId: string, url: string) {
    try {
        // Get existing metadata to check if there's an image to replace
        const existingMetadata = await MetadataService.get(contractId);

        if (existingMetadata?.image && existingMetadata.image !== url) {
            console.log(`Deleting old image for ${contractId}: ${existingMetadata.image}`);
            // Logic to delete old blob would go here
            // This would require additional implementation with the Vercel Blob SDK
        }
    } catch (error) {
        console.error('Error checking for old blob:', error);
        // Continue execution, don't block on cleanup errors
    }
}

export async function POST(request: NextRequest, context: Context) {
    try {
        const contractId = context.params.contractId;
        // Set CORS headers
        const headers = generateCorsHeaders(request, 'POST, OPTIONS');

        // Validate contract ID format
        if (!contractId || !/^[A-Z0-9]{40}$/.test(contractId)) {
            return NextResponse.json(
                { error: 'Invalid contract ID format' },
                { status: 400, headers }
            );
        }

        // Get form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        // Check if file exists
        if (!file) {
            return NextResponse.json(
                { error: 'No file uploaded' },
                { status: 400, headers }
            );
        }

        // Validate file is an image
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { error: 'File must be an image' },
                { status: 400, headers }
            );
        }

        // Upload to Vercel Blob
        const blob = await put(`${contractId}-${Date.now()}`, file, {
            access: 'public',
        });

        // Update metadata with the new image URL
        try {
            // Delete old blob if it exists
            await deleteOldBlobIfExists(contractId, blob.url);

            // Update metadata with new image URL
            await MetadataService.set(contractId, { image: blob.url });

            return NextResponse.json({
                url: blob.url,
                success: true,
                message: 'Image uploaded successfully'
            }, { status: 200, headers });
        } catch (error) {
            console.error('Error updating metadata with image:', error);
            // Still return success since the blob was uploaded
            return NextResponse.json({
                url: blob.url,
                success: true,
                warning: 'Image uploaded but metadata could not be updated'
            }, { status: 200, headers });
        }
    } catch (error) {
        console.error('Error in upload route:', error);
        const headers = generateCorsHeaders(request, 'POST, OPTIONS');
        return NextResponse.json(
            { error: `Failed to upload: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500, headers }
        );
    }
}

export async function OPTIONS(request: NextRequest) {
    const headers = generateCorsHeaders(request, 'POST, OPTIONS');
    return new NextResponse(null, { status: 204, headers });
} 