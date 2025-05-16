export const getRandomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const getRandomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

export const generateRandomSvgDataUri = (): string => {
    const palette = {
        dark: ['#1a1a1a', '#2b2b2b', '#3c3c3c', '#000000', '#0d1b2a', '#1b263b', '#415a77', '#222222', '#111111'],
        accent: ['#c1121f', '#e71d36', '#2ec4b6', '#00b4d8', '#ff9f1c', '#9b59b6', '#3498db', '#f1c40f', '#e67e22', '#1abc9c', '#d35400'],
        neutral: ['#CED4DA', '#ADB5BD', '#6C757D']
    };

    const size = 128; // Smaller canvas size for smaller footprint
    let svgElements = '';

    // 1. Background (mostly solid, occasionally simple gradient)
    const bgColor = getRandomItem(palette.dark);
    if (Math.random() < 0.25) { // 25% chance of a simple linear gradient
        const gradColor1 = bgColor;
        const gradColor2 = getRandomItem(palette.dark.filter(c => c !== gradColor1) || [palette.neutral[0]]);
        const angle = getRandomItem([0, 45, 90, 135]);
        svgElements += `
            <defs>
                <linearGradient id="bgLinGrad" x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform="rotate(${angle})">
                    <stop offset="0%" stop-color="${gradColor1}" />
                    <stop offset="100%" stop-color="${gradColor2}" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bgLinGrad)"/>
        `;
    } else {
        svgElements += `<rect width="100%" height="100%" fill="${bgColor}"/>`;
    }

    // 2. Main Shapes (1 or 2)
    const numMainShapes = getRandomInt(1, 2);
    for (let i = 0; i < numMainShapes; i++) {
        const shapeType = Math.random() > 0.4 ? 'rect' : 'circle'; // Slightly more chance for rects
        const fillColor = getRandomItem(palette.accent);
        const opacity = Math.random() * 0.3 + 0.7; // 0.7 to 1.0

        if (shapeType === 'rect') {
            const w = getRandomInt(size * 0.2, size * 0.6);
            const h = getRandomInt(size * 0.2, size * 0.6);
            const x = getRandomInt(0, size - w);
            const y = getRandomInt(0, size - h);
            const rx = Math.random() > 0.6 ? getRandomInt(2, 8) : 0; // Optional rounded corners, less frequent
            svgElements += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fillColor}" opacity="${opacity}"/>`;
        } else { // Circle
            const r = getRandomInt(size * 0.1, size * 0.3);
            const cx = getRandomInt(r, size - r);
            const cy = getRandomInt(r, size - r);
            svgElements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fillColor}" opacity="${opacity}"/>`;
        }
    }

    // 3. Optional Accent Element (e.g., a thin line or small dot)
    if (Math.random() < 0.5) { // 50% chance of an accent
        const accentColor = getRandomItem(palette.neutral.concat(palette.accent));
        const accentType = Math.random();
        if (accentType < 0.6) { // Thin line
            const x1 = getRandomInt(size * 0.1, size * 0.9);
            const y1 = getRandomInt(size * 0.1, size * 0.9);
            const x2 = x1 + getRandomInt(-size * 0.3, size * 0.3);
            const y2 = y1 + getRandomInt(-size * 0.3, size * 0.3);
            const strokeWidth = getRandomInt(1, 2);
            svgElements += `<line x1="${x1}" y1="${y1}" x2="${x2 > size ? size : (x2 < 0 ? 0 : x2)}" y2="${y2 > size ? size : (y2 < 0 ? 0 : y2)}" stroke="${accentColor}" stroke-width="${strokeWidth}" opacity="0.7"/>`;
        } else { // Small dot (circle)
            const r = getRandomInt(2, 4);
            const cx = getRandomInt(r, size - r);
            const cy = getRandomInt(r, size - r);
            svgElements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accentColor}" opacity="0.85"/>`;
        }
    }

    const svgString = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
    // Ensure proper UTF-8 handling for base64:
    // 1. Encode to UTF-8 URI components
    // 2. unescape to get raw UTF-8 string
    // 3. btoa to base64
    const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
    return `data:image/svg+xml;base64,${base64Svg}`;
}; 