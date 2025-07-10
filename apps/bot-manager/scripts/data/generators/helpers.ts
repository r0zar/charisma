// Helper utilities for data generation
import { GeneratorOptions } from '@/types/app-state';

// Seeded random number generator for deterministic data
export class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
  
  nextBoolean(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
  
  choice<T>(array: readonly T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
  
  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  weightedChoice<T>(choices: T[], weights: number[]): T {
    if (choices.length !== weights.length) {
      throw new Error('Choices and weights arrays must have the same length');
    }
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = this.next() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < choices.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return choices[i];
      }
    }
    
    // Fallback to last choice
    return choices[choices.length - 1];
  }
}

// Generate realistic Stacks addresses
export function generateStacksAddress(rng: SeededRandom, testnet: boolean = false): string {
  const prefix = testnet ? 'ST' : 'SP';
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let address = prefix;
  
  for (let i = 0; i < 38; i++) {
    address += chars[rng.nextInt(0, chars.length - 1)];
  }
  
  return address;
}

// Generate realistic transaction hashes
export function generateTxHash(rng: SeededRandom): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  
  for (let i = 0; i < 64; i++) {
    hash += chars[rng.nextInt(0, chars.length - 1)];
  }
  
  return hash;
}

// Generate realistic contract IDs
export function generateContractId(rng: SeededRandom, contractName: string): string {
  const address = generateStacksAddress(rng);
  return `${address}.${contractName}`;
}

// Generate realistic dates within a range
export function generateDate(rng: SeededRandom, daysBack: number = 30): string {
  const now = new Date();
  const daysAgo = rng.nextInt(0, daysBack);
  const hoursAgo = rng.nextInt(0, 24);
  const minutesAgo = rng.nextInt(0, 60);
  
  const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000));
  return date.toISOString();
}

// Generate realistic names
export const BOT_NAMES = [
  'Bulbasaur',
  'Ivysaur',
  'Venusaur',
  'Charmander',
  'Charmeleon',
  'Charizard',
  'Squirtle',
  'Wartortle',
  'Blastoise',
  'Caterpie',
  'Metapod',
  'Butterfree',
  'Weedle',
  'Kakuna',
  'Beedrill',
  'Pidgey',
  'Pidgeotto',
  'Pidgeot',
  'Rattata',
  'Raticate',
  'Spearow',
  'Fearow',
  'Ekans',
  'Arbok',
  'Pikachu',
  'Raichu',
  'Sandshrew',
  'Sandslash',
  'Nidoran♀',
  'Nidorina',
  'Nidoqueen',
  'Nidoran♂',
  'Nidorino',
  'Nidoking',
  'Clefairy',
  'Clefable',
  'Vulpix',
  'Ninetales',
  'Jigglypuff',
  'Wigglytuff',
  'Zubat',
  'Golbat',
  'Oddish',
  'Gloom',
  'Vileplume',
  'Paras',
  'Parasect',
  'Venonat',
  'Venomoth',
  'Diglett',
  'Dugtrio',
  'Meowth',
  'Persian',
  'Psyduck',
  'Golduck',
  'Mankey',
  'Primeape',
  'Growlithe',
  'Arcanine',
  'Poliwag',
  'Poliwhirl',
  'Poliwrath',
  'Abra',
  'Kadabra',
  'Alakazam',
  'Machop',
  'Machoke',
  'Machamp',
  'Bellsprout',
  'Weepinbell',
  'Victreebel',
  'Tentacool',
  'Tentacruel',
  'Geodude',
  'Graveler',
  'Golem',
  'Ponyta',
  'Rapidash',
  'Slowpoke',
  'Slowbro',
  'Magnemite',
  'Magneton',
  'Farfetchd',
  'Doduo',
  'Dodrio',
  'Seel',
  'Dewgong',
  'Grimer',
  'Muk',
  'Shellder',
  'Cloyster',
  'Gastly',
  'Haunter',
  'Gengar',
  'Onix',
  'Drowzee',
  'Hypno',
  'Krabby',
  'Kingler',
  'Voltorb',
  'Electrode',
  'Exeggcute',
  'Exeggutor',
  'Cubone',
  'Marowak',
  'Hitmonlee',
  'Hitmonchan',
  'Lickitung',
  'Koffing',
  'Weezing',
  'Rhyhorn',
  'Rhydon',
  'Chansey',
  'Tangela',
  'Kangaskhan',
  'Horsea',
  'Seadra',
  'Goldeen',
  'Seaking',
  'Staryu',
  'Starmie',
  'Mr. Mime',
  'Scyther',
  'Jynx',
  'Electabuzz',
  'Magmar',
  'Pinsir',
  'Tauros',
  'Magikarp',
  'Gyarados',
  'Lapras',
  'Ditto',
  'Eevee',
  'Vaporeon',
  'Jolteon',
  'Flareon',
  'Porygon',
  'Omanyte',
  'Omastar',
  'Kabuto',
  'Kabutops',
  'Aerodactyl',
  'Snorlax',
  'Articuno',
  'Zapdos',
  'Moltres',
  'Dratini',
  'Dragonair',
  'Dragonite',
  'Mewtwo',
  'Mew',
];

export const TOKEN_NAMES = [
  { symbol: 'STX', name: 'Stacks', decimals: 6 },
  { symbol: 'ALEX', name: 'Alex', decimals: 8 },
  { symbol: 'DIKO', name: 'Diko', decimals: 6 },
  { symbol: 'USDA', name: 'USD Alex', decimals: 8 },
  { symbol: 'CHA', name: 'Charisma', decimals: 6 },
  { symbol: 'WELSH', name: 'Welsh', decimals: 6 },
  { symbol: 'PEPE', name: 'Pepe', decimals: 8 },
  { symbol: 'LISA', name: 'Lisa', decimals: 6 },
  { symbol: 'ROOS', name: 'Roos', decimals: 6 },
  { symbol: 'LEO', name: 'Leo', decimals: 8 },
];

export const BOT_STATUSES = ['active', 'paused', 'error', 'inactive', 'setup'] as const;
export const ACTIVITY_TYPES = ['yield-farming', 'deposit', 'withdrawal', 'trade', 'error'] as const;
export const ACTIVITY_STATUSES = ['pending', 'success', 'failed'] as const;

// Generate realistic amounts based on profile
export function generateAmount(rng: SeededRandom, profile: string, type: 'small' | 'medium' | 'large' = 'medium'): number {
  const multipliers = {
    development: { small: 10, medium: 100, large: 1000 },
    demo: { small: 1000, medium: 10000, large: 100000 },
    testing: { small: 1, medium: 10, large: 100 },
    production: { small: 100, medium: 1000, large: 10000 },
  };
  
  const multiplier = multipliers[profile as keyof typeof multipliers] || multipliers.development;
  const base = multiplier[type];
  
  return rng.nextFloat(base * 0.1, base * 2);
}

// Generate realistic percentage values
export function generatePercentage(rng: SeededRandom, min: number = 0, max: number = 100): number {
  return Math.round(rng.nextFloat(min, max) * 100) / 100;
}

// Generate realistic APR values
export function generateAPR(rng: SeededRandom, profile: string): number {
  const ranges = {
    development: { min: 5, max: 50 },
    demo: { min: 10, max: 200 },
    testing: { min: 0, max: 1000 },
    production: { min: 3, max: 80 },
  };
  
  const range = ranges[profile as keyof typeof ranges] || ranges.development;
  return rng.nextFloat(range.min, range.max);
}

// Generate realistic success rates
export function generateSuccessRate(rng: SeededRandom, strategyTemplate: string): number {
  const baseRates = {
    'helloWorld': 80,
    'fetchExample': 85,
  };
  
  const base = baseRates[strategyTemplate as keyof typeof baseRates] || 80;
  return rng.nextFloat(base - 10, base + 5);
}

// Generate realistic P&L based on strategy and time
export function generatePnL(rng: SeededRandom, strategyTemplate: string, daysActive: number, profile: string): {
  daily: number;
  total: number;
} {
  const baseDaily = generateAmount(rng, profile, 'small');
  const volatility = rng.nextFloat(0.5, 2);
  
  const strategyMultipliers = {
    'helloWorld': 1.0,
    'fetchExample': 1.0,
  };
  
  const multiplier = strategyMultipliers[strategyTemplate as keyof typeof strategyMultipliers] || 1.0;
  const daily = baseDaily * multiplier * volatility * (rng.nextBoolean(0.7) ? 1 : -1);
  
  // Calculate total with some randomness
  const totalBase = daily * daysActive;
  const total = totalBase + rng.nextFloat(-Math.abs(totalBase) * 0.3, Math.abs(totalBase) * 0.3);
  
  return {
    daily: Math.round(daily * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// Generate realistic gas prices
export function generateGasPrice(rng: SeededRandom): number {
  return rng.nextInt(500, 2000);
}

// Generate realistic slippage tolerance
export function generateSlippage(rng: SeededRandom): number {
  return rng.nextFloat(0.1, 2.0);
}

// Generate realistic time-based data
export function generateTimeSeriesData(rng: SeededRandom, days: number, baseValue: number): Array<{
  date: string;
  value: number;
}> {
  const data = [];
  let currentValue = baseValue;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Add some random walk
    const change = rng.nextFloat(-0.1, 0.1);
    currentValue *= (1 + change);
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(currentValue * 100) / 100,
    });
  }
  
  return data;
}

// Utility to create ID with prefix
export function createId(prefix: string, rng: SeededRandom): string {
  return `${prefix}-${rng.nextInt(100000, 999999)}`;
}

// Profile-based configuration
export function getProfileConfig(profile: string) {
  const configs = {
    development: {
      botCount: 3,
      daysOfHistory: 7,
      includeErrors: true,
      realisticData: false,
    },
    demo: {
      botCount: 8,
      daysOfHistory: 30,
      includeErrors: false,
      realisticData: true,
    },
    testing: {
      botCount: 5,
      daysOfHistory: 14,
      includeErrors: true,
      realisticData: false,
    },
    production: {
      botCount: 10,
      daysOfHistory: 90,
      includeErrors: true,
      realisticData: true,
    },
  };
  
  return configs[profile as keyof typeof configs] || configs.development;
}

// All exports are already defined above with export keyword