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