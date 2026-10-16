import { buildTimestampedSignatureHeaders, signMessageWithTimestamp } from 'blaze-sdk';
import { nftBaseUri } from './nft-urls';

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif)$/i;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Vercel caps a request body at 4.5 MB
const BATCH_BYTES = 3.5 * 1024 * 1024;
const BATCH_FILES = 25;
const TOKENS_PER_REQUEST = 500;

export interface Attribute { trait_type: string; value: string | number }

/** One piece of art, plus what its matching .json said about it */
export interface Piece {
    image: File;
    name?: string;
    description?: string;
    attributes?: Attribute[];
}

export interface NftToken {
    name: string;
    description?: string;
    image: string;
    attributes?: Attribute[];
}

const stem = (file: File) => file.name.replace(/\.[^.]+$/, '');

/**
 * Pairs each image with the .json of the same name, if there is one (the layout HashLips and most art generators
 * write: 1.png + 1.json). Pieces come back in file-name order (1, 2, 10).
 */
export async function readPieces(files: File[]): Promise<Piece[]> {
    const svg = files.find(f => /\.svg$/i.test(f.name));
    if (svg) throw new Error(`${svg.name}: SVG isn't supported. Export it as PNG.`);
    const images = files.filter(f => IMAGE_FILE.test(f.name));
    if (!images.length) throw new Error('Add at least one image (PNG, JPG, GIF, WebP or AVIF)');
    const big = images.find(f => f.size > MAX_IMAGE_BYTES);
    if (big) throw new Error(`${big.name} is ${(big.size / 1024 / 1024).toFixed(1)} MB. Each image must be 4 MB or less.`);

    const json = new Map(files.filter(f => /\.json$/i.test(f.name)).map(f => [stem(f), f]));
    const pieces = await Promise.all(images.map(async (image): Promise<Piece> => {
        const file = json.get(stem(image));
        if (!file) return { image };
        let data;
        try {
            data = JSON.parse(await file.text());
        } catch {
            throw new Error(`${file.name} isn't valid JSON`);
        }
        const attributes = Array.isArray(data.attributes)
            ? data.attributes
                .filter((a: Attribute) => typeof a?.trait_type === 'string' && (typeof a.value === 'string' || typeof a.value === 'number'))
                .map((a: Attribute) => ({ trait_type: a.trait_type, value: a.value }))
            : undefined;
        return {
            image,
            name: typeof data.name === 'string' ? data.name : undefined,
            description: typeof data.description === 'string' && data.description ? data.description : undefined,
            attributes: attributes?.length ? attributes : undefined,
        };
    }));
    return pieces.sort((a, b) => a.image.name.localeCompare(b.image.name, undefined, { numeric: true }));
}

/** A fair shuffle, so the order pieces mint in can't be predicted */
export function shuffled<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** A piece's name as token `id`: its .json name (renumbered if it ends in #n), else its file name */
export function pieceName(piece: Piece, id: number, collectionName: string): string {
    if (piece.name) return piece.name.replace(/#\d+\s*$/, `#${id}`);
    const fileName = stem(piece.image);
    if (/^\d+$/.test(fileName)) return `${collectionName} #${id}`;
    return fileName.replace(/[_-]+/g, ' ').trim();
}

const randomName = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
const extension = (file: File) => file.name.split('.').pop()!.toLowerCase();

/**
 * Numbers the pieces 1, 2, 3... in the order given. Images get random file names, so a piece that isn't minted yet
 * can't be found by guessing its link.
 */
export function buildCollection(pieces: Piece[], contractId: string, collectionName: string) {
    const base = nftBaseUri(contractId);
    const tokens: Record<string, NftToken> = {};
    const images: [string, File][] = [];
    pieces.forEach((piece, i) => {
        const path = `image/${randomName()}.${extension(piece.image)}`;
        images.push([path, piece.image]);
        tokens[String(i + 1)] = {
            name: pieceName(piece, i + 1, collectionName),
            description: piece.description,
            image: `${base}${path}`,
            attributes: piece.attributes,
        };
    });
    return { tokens, images };
}

export type UploadProgress = (step: string, done: number, total: number) => void;

/**
 * Uploads a collection to metadata.charisma.rocks: its details, then every image, then every token's metadata.
 * The wallet signs once for the whole upload. A new upload replaces the collection's tokens.
 */
export async function uploadCollection(
    contractId: string,
    details: { name: string; description?: string },
    { tokens, images }: ReturnType<typeof buildCollection>,
    cover: File | null,
    onProgress: UploadProgress,
) {
    onProgress('Waiting for your wallet', 0, 1);
    const headers = buildTimestampedSignatureHeaders(await signMessageWithTimestamp(contractId));
    const send = async (path: string, body: FormData | object) => {
        const res = await fetch(`/api/v1/nft/${contractId}${path}`, {
            method: 'POST',
            headers: body instanceof FormData ? headers : { ...headers, 'Content-Type': 'application/json' },
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
        const result = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        if (!res.ok || !result.success) throw new Error(result.error ?? `Upload failed: HTTP ${res.status}`);
        return result;
    };

    const coverPath = cover ? `cover/${randomName()}.${extension(cover)}` : null;
    const info = { ...details, image: coverPath ? `${nftBaseUri(contractId)}${coverPath}` : undefined };
    onProgress('Saving details', 0, 1);
    await send('', { ...info, reset: true });

    // Images in batches under the request size limit, three at a time
    const batches: [string, File][][] = [];
    for (const entry of coverPath && cover ? [[coverPath, cover] as [string, File], ...images] : images) {
        const last = batches[batches.length - 1];
        const size = last?.reduce((sum, [, f]) => sum + f.size, 0) ?? 0;
        if (last && last.length < BATCH_FILES && size + entry[1].size <= BATCH_BYTES) last.push(entry);
        else batches.push([entry]);
    }
    const total = batches.reduce((sum, b) => sum + b.length, 0);
    let sent = 0;
    onProgress('Uploading images', 0, total);
    await Promise.all(Array.from({ length: 3 }, async () => {
        for (let batch = batches.shift(); batch; batch = batches.shift()) {
            const form = new FormData();
            for (const [path, file] of batch) form.append(path, file);
            await send('/images', form);
            sent += batch.length;
            onProgress('Uploading images', sent, total);
        }
    }));

    const ids = Object.keys(tokens);
    for (let i = 0; i < ids.length; i += TOKENS_PER_REQUEST) {
        await send('', { ...info, tokens: Object.fromEntries(ids.slice(i, i + TOKENS_PER_REQUEST).map(id => [id, tokens[id]])) });
        onProgress('Saving names and traits', Math.min(i + TOKENS_PER_REQUEST, ids.length), ids.length);
    }
}
