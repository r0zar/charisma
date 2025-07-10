import { type Bot, type BotStats } from '@/schemas/bot.schema';

/**
 * Bot list data
 */
export const botListData: Bot[] = [
  {
    id: "SPZL9EBWR5GJIC3SZWGRBW5SIIQRBK0XPPSK9BK3", // Bot's wallet address
    name: "Seaking",
    strategy: "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
    status: "inactive",
    ownerId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // Owner's STX address
    createdAt: "2025-06-29T12:11:36.944Z",
    lastActive: "2025-07-09T23:47:36.944Z",
    image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/119.png",
    imageType: "pokemon",
    isScheduled: false,
    executionCount: 0,
    publicKey: "032e8d6a7f6c4e5b8d9a2c3f4e5d6c7b8a9e0f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2"
  },
  {
    id: "SP1M92JFF8JJ5ZSQ8NCNHFPRERUO96ON6SA9HMU5", // Bot's wallet address
    name: "Ninetales",
    strategy: "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
    status: "paused",
    ownerId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // Owner's STX address
    createdAt: "2025-07-09T09:07:36.944Z",
    lastActive: "2025-07-09T23:23:36.944Z",
    image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/38.png",
    imageType: "pokemon",
    isScheduled: false,
    executionCount: 0,
    publicKey: "031b4f8e7c5a9d2e6f3c8b4a1d5e9f2c6b8a4d7e0f3c6b9a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7c0b3a6d9e2f5c8b1a4d7e0f3c6b9a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7"
  },
  {
    id: "SP061XR37HS8TJH4SBVW7FAI8FOPP49J9BBIAIAL", // Bot's wallet address
    name: "Sandshrew",
    strategy: "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
    status: "error",
    ownerId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // Owner's STX address
    createdAt: "2025-07-04T02:26:36.944Z",
    lastActive: "2025-07-09T23:06:36.944Z",
    image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/27.png",
    imageType: "pokemon",
    isScheduled: false,
    executionCount: 0,
    publicKey: "02a7c3f8e1d4b6a9c2f5e8d1b4a7c0f3e6d9c2b5a8f1d4e7c0b3a6d9e2f5c8b1a4d7e0f3c6b9a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7c0b3a6d9e2f5c8b1a4d7e0f3c6b9"
  },
  {
    id: "STOVY3Q6T0M95QUKXYOM2W8JN6UCUCDPH75P7KDU", // Bot's wallet address
    name: "Doduo",
    strategy: "console.log('🚀 Starting strategy for', bot.name);\nconsole.log('Balance:', bot.balance.STX, 'STX');\n\nif (bot.balance.STX > 1000000) {\n  await bot.swap('STX', 'USDA', 500000);\n  console.log('✅ Swap completed');\n}",
    status: "inactive",
    ownerId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // Owner's STX address
    createdAt: "2025-07-05T14:34:36.944Z",
    lastActive: "2025-07-09T05:29:36.944Z",
    image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/84.png",
    imageType: "pokemon",
    isScheduled: false,
    executionCount: 0,
    publicKey: "03d9e2f5c8b1a4d7e0f3c6b9a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7c0b3a6d9e2f5c8b1a4d7e0f3c6b9a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7c0b3a6d9e2f5c8b1a4d7"
  },
  {
    id: "SPK0DIL2R9COFLOI78XNQ3ALEK7BW17PGJEWOET2", // Bot's wallet address
    name: "Seaking",
    strategy: "console.log('🚀 Starting fetch strategy for', bot.name);\n\ntry {\n  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');\n  const data = await response.json();\n  console.log('📊 Bitcoin price data:', data.bitcoin.usd);\n  \n  console.log('Current bot balance:', bot.balance.STX, 'STX');\n} catch (error) {\n  console.log('❌ Fetch failed:', error.message);\n}",
    status: "active",
    ownerId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", // Owner's STX address
    createdAt: "2025-07-03T04:55:36.944Z",
    lastActive: "2025-07-09T10:27:36.944Z",
    image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/119.png",
    imageType: "pokemon",
    isScheduled: false,
    executionCount: 0,
    publicKey: "02f5c8b1a4d7e0f3c6b9a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7c0b3a6d9e2f5c8b1a4d7e0f3c6b9a2d5e8f1c4b7a0d3e6f9c2b5a8d1e4f7c0b3a6d9e2f5c8b1a4d7e0f3c6"
  }
];

/**
 * Bot statistics data
 */
export const botStatsData: BotStats = {
  totalBots: 5,
  activeBots: 1,
  pausedBots: 1,
  errorBots: 1
};