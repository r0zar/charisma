// TypeScript declaration handled in src/types/colorthief.d.ts

import ColorThief from 'colorthief';

/**
 * Convert RGB array to hex color string
 */
export function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Check if a color is too dark or too light for good contrast
 */
export function isColorUsable(rgb: [number, number, number]): boolean {
  // Calculate luminance
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
  // Reject colors that are too dark (< 0.05) or too light (> 0.95)
  return luminance > 0.05 && luminance < 0.95;
}

/**
 * Extract dominant color from an image URL or HTMLImageElement
 */
export async function extractDominantColor(
  imageSource: string | HTMLImageElement
): Promise<string> {
  return new Promise((resolve, reject) => {
    const colorThief = new ColorThief();
    
    if (typeof imageSource === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Get the dominant color
          const dominantColor = (colorThief as any).getColor(img, 10);
          
          // If the dominant color isn't usable, try to get a palette and find a better one
          if (!isColorUsable(dominantColor)) {
            const palette = (colorThief as any).getPalette(img, 5, 10);
            const usableColor = palette.find(isColorUsable);
            
            if (usableColor) {
              resolve(rgbToHex(usableColor));
            } else {
              // Fallback to a neutral color
              resolve('#6366f1'); // Default indigo
            }
          } else {
            resolve(rgbToHex(dominantColor));
          }
        } catch (error) {
          console.warn('Failed to extract color from image:', error);
          resolve('#6366f1'); // Default indigo
        }
      };
      
      img.onerror = () => {
        console.warn('Failed to load image for color extraction');
        resolve('#6366f1'); // Default indigo
      };
      
      img.src = imageSource;
    } else {
      try {
        const dominantColor = (colorThief as any).getColor(imageSource, 10);
        
        if (!isColorUsable(dominantColor)) {
          const palette = (colorThief as any).getPalette(imageSource, 5, 10);
          const usableColor = palette.find(isColorUsable);
          
          if (usableColor) {
            resolve(rgbToHex(usableColor));
          } else {
            resolve('#6366f1'); // Default indigo
          }
        } else {
          resolve(rgbToHex(dominantColor));
        }
      } catch (error) {
        console.warn('Failed to extract color from image element:', error);
        resolve('#6366f1'); // Default indigo
      }
    }
  });
}

/**
 * Generate a lighter version of a color for progress bars
 */
export function lightenColor(hex: string, amount: number = 0.3): string {
  const color = hex.replace('#', '');
  const num = parseInt(color, 16);
  
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * amount));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * amount));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * amount));
  
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Cache for extracted colors to avoid recomputing
 */
const colorCache = new Map<string, string>();

/**
 * Get cached color or extract it if not cached
 */
export async function getCachedTokenColor(imageUrl: string): Promise<string> {
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }
  
  const color = await extractDominantColor(imageUrl);
  colorCache.set(imageUrl, color);
  return color;
}