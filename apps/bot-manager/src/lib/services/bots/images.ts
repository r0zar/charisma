/**
 * Bot Image Utility Functions
 * Handles bot image generation, fallbacks, and Pokemon sprite integration
 */

import { getPokemonSpriteUrl, hasPokemonSprite,pokemonSprites } from '@/data/pokemon-sprites';
import { Bot } from '@/schemas/bot.schema';

export type BotImageType = 'pokemon' | 'avatar' | 'custom';

/**
 * Generate a Pokemon sprite URL for a given Pokemon name
 */
export function generatePokemonImageUrl(pokemonName: string): string | null {
  return getPokemonSpriteUrl(pokemonName);
}

/**
 * Generate an avatar URL using Robohash (robot-themed avatars)
 */
export function generateAvatarImageUrl(seed: string): string {
  // Using Robohash for robot-themed avatars - perfect for bots!
  // Set 1: Robots (default), size 200x200, PNG format
  return `https://robohash.org/${encodeURIComponent(seed)}.png?size=200x200&set=set1`;
}

/**
 * Generate a custom bot icon URL (placeholder for future implementation)
 */
export function generateCustomImageUrl(botId: string): string {
  // Placeholder for custom bot icons - could be local assets or uploaded images
  return `/images/bots/custom/${botId}.png`;
}

/**
 * Generate bot image URL based on bot name and image type
 */
export function generateBotImageUrl(
  botName: string,
  imageType: BotImageType = 'pokemon',
  botId?: string
): string {
  switch (imageType) {
    case 'pokemon':
      const pokemonUrl = generatePokemonImageUrl(botName);
      if (pokemonUrl) {
        return pokemonUrl;
      }
      // Fallback to avatar if Pokemon name not found
      return generateAvatarImageUrl(botName);
      
    case 'avatar':
      return generateAvatarImageUrl(botName);
      
    case 'custom':
      return generateCustomImageUrl(botId || botName);
      
    default:
      return generateAvatarImageUrl(botName);
  }
}

/**
 * Get bot image URL with fallback handling
 */
export function getBotImageWithFallback(bot: Bot): string {
  // If bot has a specific image URL, use it
  if (bot.image) {
    return bot.image;
  }

  // Generate image based on bot name and type
  const imageType = bot.imageType || 'pokemon';
  return generateBotImageUrl(bot.name, imageType, bot.id);
}

/**
 * Get fallback image URL for when primary image fails to load
 */
export function getBotImageFallback(botName: string): string {
  // Use avatar as fallback since it's always available
  return generateAvatarImageUrl(botName);
}

/**
 * Validate if a URL is a valid image URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check if it's a valid URL with http/https protocol
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get the appropriate image type for a bot name
 */
export function getImageTypeForBotName(botName: string): BotImageType {
  if (hasPokemonSprite(botName)) {
    return 'pokemon';
  }
  return 'avatar';
}

/**
 * Create a complete bot image configuration
 */
export function createBotImageConfig(
  botName: string,
  botId: string,
  preferredType?: BotImageType
): { image: string; imageType: BotImageType } {
  const imageType = preferredType || getImageTypeForBotName(botName);
  const image = generateBotImageUrl(botName, imageType, botId);
  
  return {
    image,
    imageType,
  };
}

/**
 * Preload image to check if it loads successfully
 */
export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Get a deterministic avatar for a bot name (useful for consistent fallbacks)
 */
export function getDeterministicBotAvatar(botName: string): string {
  // Create a simple hash of the bot name for consistent avatar generation
  let hash = 0;
  for (let i = 0; i < botName.length; i++) {
    const char = botName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash as a seed for consistent avatar generation
  const seed = Math.abs(hash).toString();
  return generateAvatarImageUrl(seed);
}

/**
 * Get all available Pokemon sprite names (for validation/selection)
 */
export function getAvailablePokemonSprites(): string[] {
  return Object.keys(pokemonSprites);
}