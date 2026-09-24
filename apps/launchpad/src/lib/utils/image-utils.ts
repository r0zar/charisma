/**
 * Generates a random hex color.
 * @returns A random hex color string (e.g., '#3a7bd5')
 */
export const generateRandomColor = (): string => {
    const colors = [
        '#3a7bd5', '#00d2ff', '#fa709a', '#fee140',
        '#a8edea', '#fed6e3', '#ffecd2', '#fcb69f',
        '#667eea', '#764ba2', '#f093fb', '#f5576c',
        '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
        '#ffeaa7', '#fab1a0', '#ff7675', '#fd79a8',
        '#6c5ce7', '#a29bfe', '#00b894', '#00cec9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Generates a simple 2x2 pixel art data URI string.
 * @param color1 First color for the pattern (hex or rgb).
 * @param color2 Second color for the pattern (hex or rgb).
 * @param width Width of the output image.
 * @param height Height of the output image.
 * @returns A base64 encoded data URI string for the generated image.
 */
export const generatePixelArtDataUri = (color1 = '#cccccc', color2 = '#999999', width = 4, height = 4): string => {
    if (typeof document === 'undefined') {
        // Return a minimal transparent PNG if document is not available (e.g., during SSR pre-generation)
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = 2;
        patternCanvas.height = 2;
        const pctx = patternCanvas.getContext('2d');

        if (pctx) {
            pctx.fillStyle = color1;
            pctx.fillRect(0, 0, 1, 1);
            pctx.fillRect(1, 1, 1, 1);
            pctx.fillStyle = color2;
            pctx.fillRect(1, 0, 1, 1);
            pctx.fillRect(0, 1, 1, 1);

            const pattern = ctx.createPattern(patternCanvas, 'repeat');
            if (pattern) {
                ctx.fillStyle = pattern;
                ctx.fillRect(0, 0, width, height);
            }
        }
    }
    return canvas.toDataURL();
};

/**
 * Generates an ultra-minimal 1x1 transparent pixel data URI for on-chain storage.
 * This is the smallest possible valid image (37 characters).
 * @returns A minimal PNG data URI (~37 chars)
 */
export const generateMinimalDataUri = (): string => {
    // 1x1 transparent PNG - smallest possible valid image
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
};

/**
 * Generates a 1x1 solid color pixel data URI.
 * Slightly larger than transparent but allows custom colors.
 * @param color Hex color (e.g., '#ff0000' for red). If 'random', generates a random color.
 * @returns A 1x1 colored pixel data URI (~45-50 chars)
 */
export const generate1x1ColorPixel = (color: string | 'random' = '#666666'): string => {
    const actualColor = color === 'random' ? generateRandomColor() : color;
    const hex = actualColor.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Expected a hex color, got "${actualColor}"`);
    const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return `data:image/png;base64,${toBase64(minimalPng(rgb))}`;
};

// A hand-built 1x1 RGB PNG is ~72 bytes. Canvas-generated PNGs carry extra chunks and push the
// 256-char on-chain metadata limit, so the pixel is assembled byte by byte here instead.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc32 = (bytes: number[]): number => {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const be32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const pngChunk = (type: string, data: number[]): number[] => {
    const typeBytes = Array.from(type, (ch) => ch.charCodeAt(0));
    return [...be32(data.length), ...typeBytes, ...data, ...be32(crc32([...typeBytes, ...data]))];
};
const minimalPng = (rgb: number[]): number[] => {
    const scanline = [0, ...rgb]; // filter byte 0 + one RGB pixel
    let a = 1, b = 0;
    for (const x of scanline) { a = (a + x) % 65521; b = (b + a) % 65521; }
    const zlib = [0x78, 0x01, 0x01, scanline.length, 0, 0xff - scanline.length, 0xff, ...scanline, ...be32((b << 16) | a)];
    return [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ...pngChunk('IHDR', [...be32(1), ...be32(1), 8, 2, 0, 0, 0]),
        ...pngChunk('IDAT', zlib),
        ...pngChunk('IEND', []),
    ];
};
const toBase64 = (bytes: number[]): string =>
    typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(String.fromCharCode(...bytes));

/**
 * Generates a compact SVG data URI for on-chain metadata.
 * Uses SVG which compresses better than PNG for simple graphics.
 * @param color Primary color (hex format). If 'random', generates a random color.
 * @returns A compact SVG data URI (typically 50-80 chars)
 */
export const generateCompactSvgDataUri = (color: string | 'random' = '#666'): string => {
    const actualColor = color === 'random' ? generateRandomColor() : color;
    // Simple circle SVG - compact and scalable
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1" fill="${actualColor}"/></svg>`;
    const base64 = typeof Buffer !== 'undefined' ? Buffer.from(svg).toString('base64') : btoa(svg);
    return `data:image/svg+xml;base64,${base64}`;
};

/**
 * Generates optimized metadata for on-chain storage within 256 char limit.
 * Uses standard field names (name, image) and optimized content.
 * @param symbol Token symbol (keep short)
 * @param imageType Type of image to use: 'transparent', 'color', or 'svg'
 * @param color Color for colored pixel or SVG (hex format). Use 'random' for random colors.
 * @returns Complete metadata JSON and data URI under 256 chars
 */
export const generateOptimizedOnChainMetadata = (
    symbol: string,
    imageType: 'transparent' | 'color' | 'svg' = 'transparent',
    color: string | 'random' = 'random'
): {
    json: object,
    dataUri: string,
    length: number
} => {
    let image: string;

    switch (imageType) {
        case 'color':
            image = generate1x1ColorPixel(color);
            break;
        case 'svg':
            image = generateCompactSvgDataUri(color);
            break;
        case 'transparent':
        default:
            image = generateMinimalDataUri();
            break;
    }

    // Use standard field names but optimize content for brevity - no description to save space
    const metadata = {
        name: `${symbol}-SL`, // Shortened but descriptive
        image
    };

    const jsonString = JSON.stringify(metadata);
    const base64 = typeof Buffer !== 'undefined' ? Buffer.from(jsonString).toString('base64') : btoa(jsonString);
    const dataUri = `data:application/json;base64,${base64}`;

    return {
        json: metadata,
        dataUri,
        length: dataUri.length
    };
};

/**
 * Deterministic 5x5 mirrored identicon as an SVG data URI. Same seed, same art; change the
 * seed (e.g. append a nonce) to get a different one. Meant for hosted metadata, not on-chain URIs.
 */
export const generateIdenticonSvgDataUri = (seed: string): string => {
    let h = 2166136261;
    for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const next = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const hue = Math.floor(next() * 360);
    const accentHue = (hue + (next() < 0.5 ? 150 : 30)) % 360;
    const bg = `hsl(${hue} 35% 14%)`;
    const fg = `hsl(${accentHue} 80% 60%)`;
    let cells = '';
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
            if (next() < 0.5) continue;
            cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
            if (x !== 2) cells += `<rect x="${4 - x}" y="${y}" width="1" height="1"/>`;
        }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" shape-rendering="crispEdges"><rect width="5" height="5" fill="${bg}"/><g fill="${fg}">${cells}</g></svg>`;
    return `data:image/svg+xml;base64,${typeof Buffer !== 'undefined' ? Buffer.from(svg).toString('base64') : btoa(svg)}`;
};

/** Clarity token-uri vars in the launchpad templates are (string-utf8 256). */
export const ONCHAIN_METADATA_URI_LIMIT = 256;

/**
 * Builds an on-chain metadata data URI for `name` that fits the 256-char token-uri limit.
 * Tries a colored pixel, then a transparent pixel, then the bare-symbol form; throws if none fits.
 */
export const generateOnChainMetadataUriWithinLimit = (name: string): { dataUri: string; length: number } => {
    const candidates = [
        () => generateCustomOptimizedMetadata(name, 'color', 'random'),
        () => generateCustomOptimizedMetadata(name, 'transparent'),
        () => generateUltraCompactMetadata(name),
    ];
    let shortest = Infinity;
    for (const make of candidates) {
        const { dataUri, length } = make();
        if (length <= ONCHAIN_METADATA_URI_LIMIT) return { dataUri, length };
        shortest = Math.min(shortest, length);
    }
    throw new Error(`On-chain metadata for "${name}" is ${shortest} characters even at its smallest; the limit is ${ONCHAIN_METADATA_URI_LIMIT}. Use a shorter name.`);
};

/**
 * Generates extremely compact metadata using only essential content.
 * Still uses standard field names for compatibility.
 * @param symbol Token symbol (1-3 chars recommended for maximum space saving)
 * @returns Ultra-compact metadata under 256 chars with standard field names
 */
export const generateUltraCompactMetadata = (symbol: string): {
    json: object,
    dataUri: string,
    length: number
} => {
    // Ultra-minimal content but standard field names - no description
    const metadata = {
        name: symbol, // Just the symbol as name
        image: generateMinimalDataUri() // Smallest possible image
    };

    const jsonString = JSON.stringify(metadata);
    const base64 = typeof Buffer !== 'undefined' ? Buffer.from(jsonString).toString('base64') : btoa(jsonString);
    const dataUri = `data:application/json;base64,${base64}`;

    return {
        json: metadata,
        dataUri,
        length: dataUri.length
    };
};

/**
 * Generates metadata with custom content but optimized for size.
 * Allows full customization while maintaining standard field names.
 * @param name Custom name (keep short)
 * @param imageType Type of image to use
 * @param color Color for colored images. Use 'random' for random colors.
 * @returns Custom metadata optimized for size
 */
export const generateCustomOptimizedMetadata = (
    name: string,
    imageType: 'transparent' | 'color' | 'svg' = 'transparent',
    color: string | 'random' = 'random'
): {
    json: object,
    dataUri: string,
    length: number
} => {
    let image: string;

    switch (imageType) {
        case 'color':
            image = generate1x1ColorPixel(color);
            break;
        case 'svg':
            image = generateCompactSvgDataUri(color);
            break;
        case 'transparent':
        default:
            image = generateMinimalDataUri();
            break;
    }

    // No description field to save space
    const metadata = {
        name,
        image
    };

    const jsonString = JSON.stringify(metadata);
    const base64 = typeof Buffer !== 'undefined' ? Buffer.from(jsonString).toString('base64') : btoa(jsonString);
    const dataUri = `data:application/json;base64,${base64}`;

    return {
        json: metadata,
        dataUri,
        length: dataUri.length
    };
}; 