import { useState, useEffect } from 'react';
import { getCachedTokenColor } from '@/lib/color-utils';

interface TokenColorState {
  [tokenId: string]: {
    color: string;
    loading: boolean;
  };
}

/**
 * Hook to extract and manage token colors from their images
 */
export function useTokenColors(tokens: Array<{ contractId: string; image?: string }>) {
  const [colors, setColors] = useState<TokenColorState>({});

  useEffect(() => {
    const extractColors = async () => {
      const newColors: TokenColorState = { ...colors };
      
      // Initialize loading state for all tokens that need color extraction
      tokens.forEach(token => {
        if (token.image && !newColors[token.contractId]) {
          newColors[token.contractId] = {
            color: '#6366f1', // Default color
            loading: true
          };
        }
      });
      
      setColors(newColors);

      // Extract colors for each token
      const colorPromises = tokens.map(async (token) => {
        if (!token.image || newColors[token.contractId]?.loading === false) {
          return;
        }

        try {
          const extractedColor = await getCachedTokenColor(token.image);
          
          setColors(prev => ({
            ...prev,
            [token.contractId]: {
              color: extractedColor,
              loading: false
            }
          }));
        } catch (error) {
          console.warn(`Failed to extract color for token ${token.contractId}:`, error);
          
          setColors(prev => ({
            ...prev,
            [token.contractId]: {
              color: '#6366f1', // Default fallback
              loading: false
            }
          }));
        }
      });

      await Promise.all(colorPromises);
    };

    if (tokens.length > 0) {
      extractColors();
    }
  }, [tokens.map(t => `${t.contractId}-${t.image}`).join(',')]); // Re-run when tokens or their images change

  return {
    getTokenColor: (tokenId: string): string => {
      return colors[tokenId]?.color || '#6366f1';
    },
    isLoading: (tokenId: string): boolean => {
      return colors[tokenId]?.loading || false;
    },
    colors
  };
}