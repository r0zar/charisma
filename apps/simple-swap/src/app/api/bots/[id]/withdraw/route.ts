import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { verifySignedRequest } from 'blaze-sdk';
import { makeContractCall, broadcastTransaction, uintCV, principalCV, noneCV } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { BotData, EncryptedWalletData, BotActivityRecord } from '@/types/bot';

// Encryption utilities
const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('WALLET_ENCRYPTION_KEY environment variable is required');
}

function decryptText(encrypted: string, iv: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY!).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// LP tokens that can be withdrawn
const WITHDRAWABLE_LP_TOKENS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit'
];

interface WithdrawRequest {
  userAddress: string;
  contractId: string;
  amount: number; // Amount in micro units
  recipient?: string; // Optional recipient address (defaults to user address)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: WithdrawRequest = await request.json();
    const botId = await params.id;

    const {
      userAddress,
      contractId,
      amount,
      recipient
    } = body;

    // Validate required fields
    if (!userAddress || !contractId || !amount || !botId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate contract ID is withdrawable
    if (!WITHDRAWABLE_LP_TOKENS.includes(contractId)) {
      return NextResponse.json(
        { error: 'Contract not supported for withdrawal' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
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

    // Verify bot exists and belongs to user
    const botStorageKey = `bot:${userAddress}:${botId}`;
    const botData = await kv.get<BotData>(botStorageKey);

    if (!botData) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Get encrypted wallet data for the bot
    const walletStorageKey = `wallet:${userAddress}:${botId}`;
    const encryptedWalletData = await kv.get<EncryptedWalletData>(walletStorageKey);

    if (!encryptedWalletData) {
      return NextResponse.json(
        { error: 'Bot wallet not found' },
        { status: 404 }
      );
    }

    // Decrypt the private key
    const privateKey = decryptText(
      encryptedWalletData.encryptedPrivateKey,
      encryptedWalletData.privateKeyIv
    );

    // Parse contract address and name
    const [contractAddress, contractName] = contractId.split('.');
    if (!contractAddress || !contractName) {
      return NextResponse.json(
        { error: 'Invalid contract ID format' },
        { status: 400 }
      );
    }

    // Determine recipient (default to user address)
    const withdrawalRecipient = recipient || userAddress;

    // Create activity record
    const activityId = crypto.randomUUID();
    const activityRecord: BotActivityRecord = {
      id: activityId,
      botId,
      timestamp: new Date().toISOString(),
      action: 'withdraw-lp-tokens',
      status: 'pending',
      contractAddress,
      contractName,
      functionName: 'transfer',
      amount,
      recipient: withdrawalRecipient
    };

    // Store initial activity record
    const activityKey = `bot_activity:${userAddress}:${botId}`;
    const existingActivities = await kv.get<BotActivityRecord[]>(activityKey) || [];
    existingActivities.unshift(activityRecord);

    // Keep only last 100 activity records
    if (existingActivities.length > 100) {
      existingActivities.splice(100);
    }

    await kv.set(activityKey, existingActivities);

    try {
      // Create the withdrawal transaction
      const transaction = await makeContractCall({
        contractAddress,
        contractName,
        functionName: 'transfer',
        functionArgs: [
          uintCV(amount),
          principalCV(encryptedWalletData.walletAddress), // From bot wallet
          principalCV(withdrawalRecipient), // To recipient
          noneCV() // Optional memo
        ],
        senderKey: privateKey,
        network: STACKS_MAINNET,
        postConditionMode: 'allow'
      });

      // Broadcast the transaction
      const broadcastResult = await broadcastTransaction({
        transaction,
        network: STACKS_MAINNET
      });

      if (broadcastResult.error) {
        throw new Error(broadcastResult.error);
      }

      // Update activity record with broadcast success (but still pending on-chain)
      const updatedActivityRecord: BotActivityRecord = {
        ...activityRecord,
        status: 'pending',
        txid: broadcastResult.txid
      };

      // Update activity record in storage
      const updatedActivities = existingActivities.map(activity =>
        activity.id === activityId ? updatedActivityRecord : activity
      );
      await kv.set(activityKey, updatedActivities);

      return NextResponse.json({
        success: true,
        txid: broadcastResult.txid,
        activityId,
        amount,
        recipient: withdrawalRecipient,
        contractId
      });

    } catch (withdrawalError: any) {
      // Update activity record with failure
      const failedActivityRecord: BotActivityRecord = {
        ...activityRecord,
        status: 'failure',
        errorMessage: withdrawalError.message || 'Unknown error'
      };

      // Update activity record in storage
      const updatedActivities = existingActivities.map(activity =>
        activity.id === activityId ? failedActivityRecord : activity
      );
      await kv.set(activityKey, updatedActivities);

      return NextResponse.json(
        {
          error: 'Withdrawal failed',
          details: withdrawalError.message || 'Unknown error',
          activityId
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Failed to process withdrawal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}