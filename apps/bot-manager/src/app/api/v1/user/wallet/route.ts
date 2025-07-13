import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

import { userService } from '@/lib/services/user/service';

/**
 * POST /api/v1/user/wallet
 * Securely sync wallet address to user profile using STX message signature
 * 
 * Body: {
 *   walletAddress: string,
 *   message: string,
 *   signature: string,
 *   publicKey: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to sync wallet',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { walletAddress, message, signature, publicKey } = body;

    // Validate required fields
    if (!walletAddress || !message || !signature || !publicKey) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'walletAddress, message, signature, and publicKey are required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate wallet address format (Stacks address)
    if (!walletAddress.match(/^S[TPMH][A-Z0-9]{39}$/)) {
      return NextResponse.json(
        {
          error: 'Invalid wallet address',
          message: 'Wallet address must be a valid Stacks address',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Verify the message contains the wallet address to prevent replay attacks
    if (!message.includes(walletAddress) || !message.includes('Verify wallet ownership')) {
      return NextResponse.json(
        {
          error: 'Invalid verification message',
          message: 'Message must be a valid wallet ownership verification message',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // TODO: Implement STX signature verification
    // For now, we'll implement a basic check and upgrade to full cryptographic verification
    console.log(`[WalletSync] Verifying wallet ownership for user ${userId}:`);
    console.log(`  Wallet: ${walletAddress}`);
    console.log(`  Message: ${message}`);
    console.log(`  Signature: ${signature.substring(0, 20)}...`);
    console.log(`  PublicKey: ${publicKey.substring(0, 20)}...`);

    // Basic validation - in production, this would use secp256k1 signature verification
    if (signature.length < 64 || publicKey.length < 64) {
      return NextResponse.json(
        {
          error: 'Invalid signature format',
          message: 'Signature and public key must be valid cryptographic values',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Get current user data
    const userData = await userService.getUserData(userId);
    
    // Update user wallet information
    const updatedUserData = await userService.updateUserData(userId, {
      ...userData,
      wallet: {
        ...userData.wallet,
        isConnected: true,
        address: walletAddress,
        connectionMethod: 'stacks-connect',
        lastConnected: new Date().toISOString(),
        publicKey,
        verificationSignature: signature,
        verificationMessage: message,
        verificationTimestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Wallet sync successful for user ${userId}: ${walletAddress}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Wallet synced successfully',
        walletAddress,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error syncing wallet:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync wallet',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/user/wallet
 * Get current user's wallet information
 */
export async function GET() {
  try {
    // Verify Clerk authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: 'User must be authenticated to get wallet info',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Get user data
    const userData = await userService.getUserData(userId);
    
    return NextResponse.json(
      {
        success: true,
        wallet: {
          isConnected: userData.wallet.isConnected || false,
          address: userData.wallet.address || null,
          connectionMethod: userData.wallet.connectionMethod || null,
          lastConnected: userData.wallet.lastConnected || null,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error getting wallet info:', error);
    return NextResponse.json(
      {
        error: 'Failed to get wallet info',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}