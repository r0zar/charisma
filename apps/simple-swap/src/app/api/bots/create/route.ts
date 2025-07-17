import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { verifySignedRequest } from 'blaze-sdk';
import { randomSeedPhrase, generateWallet } from '@stacks/wallet-sdk';
import { getAddressFromPrivateKey } from '@stacks/transactions';
import { CreateBotRequest, BotData, EncryptedWalletData } from '@/types/bot';

// Encryption utilities
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('WALLET_ENCRYPTION_KEY environment variable is required');
}

function encryptText(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  // Create a 32-byte key from the provided string using SHA-256
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY!).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

// Strategy configuration
const STRATEGY_CONFIG = {
  'yield-farming': {
    name: 'Yield Farmer',
    description: 'Optimize liquidity pool positions for maximum yield'
  }
} as const;

export async function POST(request: NextRequest) {
  try {
    const body: CreateBotRequest = await request.json();
    
    const {
      strategy,
      userAddress
    } = body;

    // Validate required fields
    if (!strategy || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate strategy exists
    if (!STRATEGY_CONFIG[strategy as keyof typeof STRATEGY_CONFIG]) {
      return NextResponse.json(
        { error: 'Invalid strategy' },
        { status: 400 }
      );
    }

    // Verify Blaze SDK auth signature
    const authResult = await verifySignedRequest(request, {
      message: userAddress,
      expectedAddress: userAddress
    });

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Check if user already has a bot with this strategy
    const userBotsKey = `user_bots:${userAddress}`;
    const existingBotIds = await kv.get<string[]>(userBotsKey) || [];
    
    for (const botId of existingBotIds) {
      const botStorageKey = `bot:${userAddress}:${botId}`;
      const existingBot = await kv.get<BotData>(botStorageKey);
      if (existingBot && existingBot.strategy === strategy) {
        return NextResponse.json(
          { error: `You already have a ${STRATEGY_CONFIG[strategy as keyof typeof STRATEGY_CONFIG].name}. Only one bot per strategy is allowed.` },
          { status: 409 }
        );
      }
    }

    // Generate wallet data on backend
    const mnemonic = randomSeedPhrase();
    
    // Generate wallet using the seed phrase (no network calls needed)
    const wallet = await generateWallet({
      secretKey: mnemonic,
      password: 'password'
    });

    // Extract wallet data directly from generated wallet
    const stxPrivateKey = wallet.accounts[0].stxPrivateKey;
    const walletAddress = getAddressFromPrivateKey(stxPrivateKey);

    // Generate unique bot ID
    const botId = crypto.randomUUID();

    // Encrypt sensitive wallet data with separate IVs
    const encryptedMnemonic = encryptText(mnemonic);
    const encryptedPrivateKey = encryptText(stxPrivateKey);

    const encryptedWalletData: EncryptedWalletData = {
      encryptedMnemonic: encryptedMnemonic.encrypted,
      encryptedPrivateKey: encryptedPrivateKey.encrypted,
      mnemonicIv: encryptedMnemonic.iv,
      privateKeyIv: encryptedPrivateKey.iv,
      walletAddress
    };

    // Store encrypted wallet data in KV
    const walletStorageKey = `wallet:${userAddress}:${botId}`;
    await kv.set(walletStorageKey, encryptedWalletData);

    // Auto-generate bot name based on strategy
    const botName = STRATEGY_CONFIG[strategy as keyof typeof STRATEGY_CONFIG].name;

    // Create bot data
    const botData: BotData = {
      id: botId,
      name: botName,
      strategy,
      status: 'inactive',
      walletAddress,
      dailyPnL: 0,
      totalPnL: 0,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      userId: userAddress
    };

    // Store bot data in KV
    const botStorageKey = `bot:${userAddress}:${botId}`;
    await kv.set(botStorageKey, botData);

    // Add bot to user's bot list
    const existingBots = await kv.get<string[]>(userBotsKey) || [];
    existingBots.push(botId);
    await kv.set(userBotsKey, existingBots);

    // Return bot data with wallet info (for one-time display)
    return NextResponse.json({
      id: botData.id,
      name: botData.name,
      strategy: botData.strategy,
      status: botData.status,
      walletAddress: botData.walletAddress,
      dailyPnL: botData.dailyPnL,
      totalPnL: botData.totalPnL,
      lastActive: botData.lastActive,
      createdAt: botData.createdAt,
      userId: botData.userId,
      mnemonic: mnemonic,
      privateKey: stxPrivateKey
    });

  } catch (error) {
    console.error('Failed to create bot:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}