/**
 * Imports a SIP-009 collection into the metadata service: token metadata from a folder of <id>.json files, plus every
 * image those files link on IPFS, read from local copies of the IPFS folders. Images are re-linked to
 * metadata.charisma.rocks, so the collection no longer depends on any gateway or old domain.
 *
 * Usage (from apps/metadata): node --env-file=.env.local --import tsx scripts/import-nft-collection.ts <config.json>
 * config: { contractId, slug, name, description?, metadataDir, ipfsDirs: { "<cid>": "<folder>" }, drop?: ["field", ...] }
 */
import fs from 'fs';
import path from 'path';
import { NftService, nftBaseUri } from '../src/lib/nft-service';
import type { TokenMetadata } from '../src/lib/metadata-service';

const IPFS_LINK = /\/ipfs\/(\w+)\/([\w.-]+)$/;
const CONTENT_TYPES: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
};

const { contractId, slug, name, description, metadataDir, ipfsDirs, drop = [] } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const base = nftBaseUri(slug);

// Re-link each token's IPFS images to <base><field>/<file>
const tokens: Record<string, TokenMetadata> = {};
const images = new Map<string, string>(); // <field>/<file> → local file
for (const file of fs.readdirSync(metadataDir).filter((f: string) => f.endsWith('.json'))) {
    const token = JSON.parse(fs.readFileSync(path.join(metadataDir, file), 'utf8'));
    for (const field of drop) delete token[field];
    for (const [field, value] of Object.entries(token)) {
        const link = typeof value === 'string' ? value.match(IPFS_LINK) : null;
        if (!link || !ipfsDirs[link[1]]) continue;
        const local = path.join(ipfsDirs[link[1]], link[2]);
        if (!fs.existsSync(local)) throw new Error(`${file}: ${field} links ${link[1]}/${link[2]}, which isn't in the local copy`);
        images.set(`${field}/${link[2]}`, local);
        token[field] = `${base}${field}/${link[2]}`;
    }
    tokens[file.replace(/\.json$/, '')] = token;
}
console.log(`${Object.keys(tokens).length} tokens, ${images.size} images`);

// Images, eight at a time
let imageBase = '';
let uploaded = 0;
const queue = [...images];
await Promise.all(Array.from({ length: 8 }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
        const [imagePath, local] = next;
        const contentType = CONTENT_TYPES[path.extname(local).toLowerCase()] ?? 'application/octet-stream';
        const url = await NftService.saveImage(contractId, imagePath, fs.readFileSync(local), contentType);
        imageBase ||= url.slice(0, url.length - imagePath.length);
        if (++uploaded % 500 === 0) console.log(`  images ${uploaded}/${images.size}`);
    }
}));

// Token metadata, 200 per write
const ids = Object.keys(tokens).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
for (let i = 0; i < ids.length; i += 200) {
    await NftService.saveTokens(contractId, Object.fromEntries(ids.slice(i, i + 200).map(id => [id, tokens[id]])));
}
await NftService.saveCollection({
    contractId, slug, name, description, image: tokens[ids[0]]?.image, imageBase, tokenCount: ids.length, lastUpdated: new Date().toISOString(),
});
console.log(`Done: ${base}<id>.json (images under ${imageBase})`);
