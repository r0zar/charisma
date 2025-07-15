/**
 * Demo data seeding for activity timeline
 * This creates sample activities for development and testing
 */

import { addActivity } from './storage';
import { ActivityItem } from './types';

/**
 * Generate sample activities for development
 */
export async function seedDemoActivities(): Promise<void> {
  console.log('Seeding demo activity data...');
  
  const baseTimestamp = Date.now();
  
  const demoActivities: ActivityItem[] = [
    {
      id: 'demo-swap-1',
      type: 'instant_swap',
      timestamp: baseTimestamp - 300000, // 5 minutes ago
      status: 'completed',
      owner: 'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60',
      txid: '0x123abc...def456',
      fromToken: {
        symbol: 'STX',
        amount: '1000000000', // 1000 STX
        contractId: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stx-token'
      },
      toToken: {
        symbol: 'CHA',
        amount: '50000000000', // 50000 CHA
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
      },
      metadata: {
        slippage: 0.5,
        priceImpact: 0.2,
        notes: 'Quick swap for portfolio rebalancing'
      },
      replyCount: 2,
      hasReplies: true,
      replies: [
        {
          id: 'reply-demo-1',
          activityId: 'demo-swap-1',
          content: 'Great timing on this swap! 🎯',
          timestamp: baseTimestamp - 240000,
          author: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
          metadata: { isEdited: false }
        },
        {
          id: 'reply-demo-2',
          activityId: 'demo-swap-1',
          content: 'The price impact was minimal, nice execution',
          timestamp: baseTimestamp - 180000,
          author: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
          metadata: { isEdited: false }
        }
      ]
    },
    {
      id: 'demo-order-1',
      type: 'order_filled',
      timestamp: baseTimestamp - 600000, // 10 minutes ago
      status: 'completed',
      owner: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
      txid: '0x789ghi...jkl012',
      fromToken: {
        symbol: 'CHA',
        amount: '25000000000', // 25000 CHA
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
      },
      toToken: {
        symbol: 'WELSH',
        amount: '100000000', // 100 WELSH
        contractId: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'
      },
      metadata: {
        limitPrice: '250',
        executionPrice: '248.5',
        notes: 'Limit order filled at better price'
      },
      replyCount: 1,
      hasReplies: true,
      replies: [
        {
          id: 'reply-demo-3',
          activityId: 'demo-order-1',
          content: 'Nice fill! Market is looking bullish on WELSH',
          timestamp: baseTimestamp - 540000,
          author: 'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60',
          metadata: { isEdited: false }
        }
      ]
    },
    {
      id: 'demo-twitter-1',
      type: 'twitter_trigger',
      timestamp: baseTimestamp - 900000, // 15 minutes ago
      status: 'completed',
      owner: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
      txid: '0x345mno...pqr678',
      fromToken: {
        symbol: 'STX',
        amount: '500000000', // 500 STX
        contractId: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stx-token'
      },
      toToken: {
        symbol: 'DIKO',
        amount: '2000000000', // 2000 DIKO
        contractId: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token'
      },
      metadata: {
        tweetId: '1234567890123456789',
        tweetContent: 'Just spotted a great opportunity in the $DIKO market! 📈 #DeFi #Stacks',
        confidence: 85,
        notes: 'Triggered by bullish sentiment analysis'
      },
      replyCount: 0,
      hasReplies: false
    },
    {
      id: 'demo-dca-1',
      type: 'dca_update',
      timestamp: baseTimestamp - 1800000, // 30 minutes ago
      status: 'completed',
      owner: 'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60',
      txid: '0x901stu...vwx234',
      fromToken: {
        symbol: 'USDA',
        amount: '100000000', // 100 USDA
        contractId: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token'
      },
      toToken: {
        symbol: 'STX',
        amount: '125000000', // 125 STX
        contractId: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stx-token'
      },
      metadata: {
        executionNumber: 12,
        totalInvested: '1200000000', // 1200 USDA total
        averagePrice: '0.8',
        notes: 'Weekly DCA execution #12'
      },
      replyCount: 0,
      hasReplies: false
    },
    {
      id: 'demo-order-2',
      type: 'order_cancelled',
      timestamp: baseTimestamp - 3600000, // 1 hour ago
      status: 'cancelled',
      owner: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
      fromToken: {
        symbol: 'CHA',
        amount: '10000000000', // 10000 CHA
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
      },
      toToken: {
        symbol: 'ALEX',
        amount: '500000000', // 500 ALEX
        contractId: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.alex-token'
      },
      metadata: {
        limitPrice: '20',
        cancellationReason: 'market_changed',
        notes: 'Cancelled due to market volatility'
      },
      replyCount: 0,
      hasReplies: false
    }
  ];

  // Add all demo activities
  for (const activity of demoActivities) {
    try {
      await addActivity(activity);
      console.log(`Added demo activity: ${activity.id}`);
    } catch (error) {
      console.error(`Error adding demo activity ${activity.id}:`, error);
    }
  }

  console.log(`Successfully seeded ${demoActivities.length} demo activities`);
}