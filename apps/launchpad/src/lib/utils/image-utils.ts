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
    if (typeof document === 'undefined') {
        // Fallback to transparent pixel for SSR
        return generateMinimalDataUri();
    }

    const actualColor = color === 'random' ? generateRandomColor() : color;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        ctx.fillStyle = actualColor;
        ctx.fillRect(0, 0, 1, 1);
    }

    return canvas.toDataURL('image/png');
};

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
        name: `${symbol}-sublink`, // Shortened but descriptive
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