import { NextRequest, NextResponse } from 'next/server';
import { NftService } from '@/lib/nft-service';
import { CONTRACT_ID, verifyCollectionOwner } from '@/lib/nft-auth';

// SVG is left out: it can carry scripts, and these files are served from our own domain
const IMAGE_TYPES: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
};
const IMAGE_PATH = /^[\w-]+\/[\w-]+\.(\w+)$/;

/**
 * POST /api/v1/nft/<contractId>/images: store a batch of the collection's images (multipart; each field's name is the
 * path it's served at, e.g. `image/3fa9c2.png` → https://metadata.charisma.rocks/nft/<contractId>/image/3fa9c2.png).
 * Signed by the contract's deployer, after the collection's details are saved. Keep each request under 4 MB.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ contractId: string }> }) {
    const { contractId } = await ctx.params;
    if (!CONTRACT_ID.test(contractId)) {
        return NextResponse.json({ success: false, error: `Invalid contract id: ${contractId}` }, { status: 400 });
    }

    const auth = await verifyCollectionOwner(req, contractId);
    if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    try {
        const collection = await NftService.getCollection(contractId);
        if (!collection) {
            return NextResponse.json({ success: false, error: `Save ${contractId}'s details before its images` }, { status: 404 });
        }

        const files: [string, File][] = [];
        for (const [path, file] of (await req.formData()).entries()) {
            const ext = path.match(IMAGE_PATH)?.[1]?.toLowerCase();
            if (!ext || !IMAGE_TYPES[ext]) {
                return NextResponse.json({ success: false, error: `"${path}" must be <folder>/<name>.<png|jpg|gif|webp|avif>` }, { status: 400 });
            }
            if (!(file instanceof File) || file.type !== IMAGE_TYPES[ext]) {
                return NextResponse.json({ success: false, error: `"${path}" must be a ${IMAGE_TYPES[ext]} file` }, { status: 400 });
            }
            files.push([path, file]);
        }

        let imageBase = collection.imageBase;
        for (const [path, file] of files) {
            const url = await NftService.saveImage(contractId, path, Buffer.from(await file.arrayBuffer()), file.type);
            imageBase ||= url.slice(0, url.length - path.length);
        }
        if (imageBase !== collection.imageBase) await NftService.saveCollection({ ...collection, imageBase });

        return NextResponse.json({ success: true, saved: files.length });
    } catch (error) {
        console.error(`Error saving images for ${contractId}:`, error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
