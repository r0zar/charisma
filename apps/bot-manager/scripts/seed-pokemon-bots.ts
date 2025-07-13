#!/usr/bin/env tsx

/**
 * Pokemon Bot Seeding Script
 * 
 * Creates all 151 original Pokemon as bots for a specified owner.
 * Features dry-run mode, progress tracking, and robust error handling.
 * 
 * Usage:
 *   tsx scripts/seed-pokemon-bots.ts --owner-id <user-id> [options]
 * 
 * Options:
 *   --owner-id <id>      User ID to assign bots to (required)
 *   --dry-run           Preview operations without creating bots
 *   --limit <number>    Limit number of bots to create
 *   --start-from <num>  Start from specific Pokemon number (1-151)
 *   --help              Show this help message
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { botService } from '../src/lib/services/bots/core/service';
import { getAvailablePokemonNames, getPokemonSpriteUrl } from '../src/data/pokemon-sprites';
import type { CreateBotRequest } from '../src/schemas/bot.schema';

interface ScriptOptions {
  ownerId: string;
  dryRun: boolean;
  limit?: number;
  startFrom: number;
  help: boolean;
}

interface PokemonMoves {
  [pokemonName: string]: string[];
}

// Simple Pokemon moves mapping for strategy generation
const pokemonMoves: PokemonMoves = {
  'Pikachu': ['Thunder Shock', 'Quick Attack', 'Thunder Wave'],
  'Charizard': ['Flamethrower', 'Dragon Rage', 'Fire Spin'],
  'Blastoise': ['Water Gun', 'Hydro Pump', 'Withdraw'],
  'Venusaur': ['Vine Whip', 'Razor Leaf', 'Sleep Powder'],
  'Alakazam': ['Psychic', 'Teleport', 'Confusion'],
  'Machamp': ['Karate Chop', 'Seismic Toss', 'Focus Energy'],
  'Gengar': ['Shadow Ball', 'Lick', 'Night Shade'],
  'Dragonite': ['Dragon Rush', 'Wing Attack', 'Thunder Wave'],
  'Mewtwo': ['Psychic', 'Recover', 'Barrier'],
  'Mew': ['Transform', 'Psychic', 'Metronome']
};

// Default moves for Pokemon not in the specific mapping
const defaultMoves = ['Tackle', 'Defense Curl', 'Quick Attack'];

/**
 * Parse command line arguments
 */
function parseArguments(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    ownerId: '',
    dryRun: false,
    startFrom: 1,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--owner-id':
        options.ownerId = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--start-from':
        options.startFrom = parseInt(args[++i], 10);
        break;
      case '--help':
        options.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          syncLogger.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
Pokemon Bot Seeding Script

Creates all 151 original Pokemon as bots for a specified owner.

Usage:
  tsx scripts/seed-pokemon-bots.ts --owner-id <user-id> [options]

Options:
  --owner-id <id>      User ID to assign bots to (required)
  --dry-run           Preview operations without creating bots
  --limit <number>    Limit number of bots to create
  --start-from <num>  Start from specific Pokemon number (1-151)
  --help              Show this help message

Examples:
  # Dry run to preview
  tsx scripts/seed-pokemon-bots.ts --owner-id user_123 --dry-run

  # Create first 10 Pokemon
  tsx scripts/seed-pokemon-bots.ts --owner-id user_123 --limit 10

  # Create all Pokemon starting from #25 (Pikachu)
  tsx scripts/seed-pokemon-bots.ts --owner-id user_123 --start-from 25
`);
}

/**
 * Generate Pokemon-themed strategy code
 */
function generatePokemonStrategy(pokemonName: string): string {
  const moves = pokemonMoves[pokemonName] || defaultMoves;
  
  return `
    console.log('${pokemonName} bot activated!');
    
    try {
      // Access bot context (available in all execution environments)
      console.log('Trainer:', bot.ownerId);
      console.log('Pokemon ID:', bot.id);
      console.log('Pokemon Name:', bot.name);
      
      // Pokemon-themed decision logic
      const moves = ['${moves.join("', '")}'];
      const selectedMove = moves[Math.floor(Math.random() * moves.length)];
      const effectiveness = Math.random() > 0.3 ? 'super effective' : 'not very effective';
      
      console.log(\`\${bot.name} used \${selectedMove}! It was \${effectiveness}!\`);
      
      // Simple battle outcome simulation
      const battleResult = Math.random() > 0.2 ? 'victory' : 'retreat';
      
      return {
        success: true,
        message: \`\${bot.name} used \${selectedMove}! Battle result: \${battleResult}!\`
      };
    } catch (error) {
      return {
        success: false,
        message: \`\${bot.name} fainted: \${error.message}\`
      };
    }
  `.trim();
}


/**
 * Create a single Pokemon bot
 */
async function createPokemonBot(pokemonName: string, ownerId: string, dryRun: boolean): Promise<boolean> {
  try {
    const strategy = generatePokemonStrategy(pokemonName);
    const spriteUrl = getPokemonSpriteUrl(pokemonName);
    
    const botData: CreateBotRequest = {
      name: pokemonName,
      strategy
    };

    if (dryRun) {
      syncLogger.info(`[DRY RUN] Would create ${pokemonName} bot`, {
        name: pokemonName,
        sprite: spriteUrl,
        strategyLength: strategy.length,
        ownerId
      });
      return true;
    }

    syncLogger.info(`Creating ${pokemonName} bot...`);
    
    // Set admin context for the bot service
    botService.setAdminContext(ownerId);
    
    try {
      const newBot = await botService.createBot(botData);
      
      syncLogger.success(`Successfully created ${pokemonName} bot`, {
        id: newBot.id,
        name: newBot.name,
        status: newBot.status,
        image: newBot.image
      });
      
      return true;
    } finally {
      // Always clear admin context
      botService.clearAdminContext();
    }
  } catch (error) {
    syncLogger.error(`Failed to create ${pokemonName} bot`, {
      pokemonName,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArguments();

  if (options.help) {
    showHelp();
    return;
  }

  // Validate required options
  if (!options.ownerId) {
    syncLogger.error('--owner-id is required');
    showHelp();
    process.exit(1);
  }

  if (options.startFrom < 1 || options.startFrom > 151) {
    syncLogger.error('--start-from must be between 1 and 151');
    process.exit(1);
  }

  if (options.limit && options.limit < 1) {
    syncLogger.error('--limit must be greater than 0');
    process.exit(1);
  }

  // Check if bot service is available
  if (!botService.useKV) {
    syncLogger.error('Bot service is not available (ENABLE_API_BOTS not set)');
    process.exit(1);
  }

  const allPokemon = getAvailablePokemonNames();
  syncLogger.info(`Found ${allPokemon.length} Pokemon in sprite data`);

  // Apply start-from and limit filters
  const startIndex = options.startFrom - 1;
  let pokemonToCreate = allPokemon.slice(startIndex);
  
  if (options.limit) {
    pokemonToCreate = pokemonToCreate.slice(0, options.limit);
  }

  syncLogger.info(`${options.dryRun ? '[DRY RUN] ' : ''}Preparing to create ${pokemonToCreate.length} Pokemon bots`, {
    ownerId: options.ownerId,
    startFrom: options.startFrom,
    limit: options.limit,
    dryRun: options.dryRun
  });

  // Create bots with progress tracking
  let successCount = 0;
  let failureCount = 0;
  const total = pokemonToCreate.length;

  for (let i = 0; i < pokemonToCreate.length; i++) {
    const pokemonName = pokemonToCreate[i];
    const pokemonNumber = allPokemon.indexOf(pokemonName) + 1; // Get the Pokemon number (1-151)
    const progress = `(${i + 1}/${total})`;
    
    // Determine owner based on Pokemon number:
    // Pokemon #1-137: owned by "wild" 
    // Pokemon #138-151: owned by the provided user ID (legendary Pokemon)
    const owner = pokemonNumber <= 137 ? 'wild' : options.ownerId;
    
    syncLogger.info(`${progress} Processing ${pokemonName} (#${pokemonNumber}) for owner: ${owner}...`);
    
    const success = await createPokemonBot(pokemonName, owner, options.dryRun);
    
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    // Small delay to avoid overwhelming the system
    if (!options.dryRun && i < pokemonToCreate.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Final summary
  const operation = options.dryRun ? 'DRY RUN COMPLETED' : 'SEEDING COMPLETED';
  syncLogger.success(`${operation}: Created ${successCount}/${total} Pokemon bots`, {
    successful: successCount,
    failed: failureCount,
    total,
    ownerId: options.ownerId,
    dryRun: options.dryRun
  });

  if (failureCount > 0) {
    syncLogger.warn(`${failureCount} Pokemon bots failed to create. Check logs for details.`);
    process.exit(1);
  }
}

// Execute main function with error handling
main().catch((error) => {
  syncLogger.error('Script execution failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});