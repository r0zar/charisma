// Transaction type definitions
export enum TransactionType {
    TRANSFER = 'transfer',
    PREDICT = 'predict',
    CLAIM_REWARD = 'claim-reward',
}

// Subnet contract addresses
export const WELSH = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-welsh-v1';
export const PREDICTIONS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-welsh-predictions-v1';

// Map subnet contracts to their associated tokens
export const subnetTokens: Record<`${string}.${string}`, `${string}.${string}::${string}`> = {
    [WELSH]: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token::welshcorgicoin',
    [PREDICTIONS]: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-welsh-predictions-v1::prediction-receipt'
};

// Map transaction types to their target contracts and batch functions
export const txTypeContracts: Record<TransactionType, { contract: string, batchFunction: string }> = {
    [TransactionType.TRANSFER]: { contract: WELSH, batchFunction: 'batch-transfer' },
    [TransactionType.PREDICT]: { contract: PREDICTIONS, batchFunction: 'batch-predict' },
    [TransactionType.CLAIM_REWARD]: { contract: PREDICTIONS, batchFunction: 'batch-claim-reward' }
};

// Asset definitions for frontend display
export interface Asset {
    id: string;
    name: string;
    symbol: string;
    description: string;
    subnet: string;
    icon?: string;
    type: 'token' | 'nft';  // Type of asset - fungible token or NFT
}

// List of available assets for the user
export const assets: Asset[] = [
    {
        id: 'welsh',
        name: 'Welsh Corgi Coin',
        symbol: 'WELSH',
        description: 'The native token of the Welsh subnet',
        subnet: WELSH,
        icon: 'welsh-icon.png',
        type: 'token'
    },
    {
        id: 'prediction',
        name: 'Prediction Receipt',
        symbol: 'PREDICT',
        description: 'Predictions receipt NFT for the Welsh subnet',
        subnet: PREDICTIONS,
        icon: 'prediction-icon.png',
        type: 'nft'
    }
];

// Filter assets by type
export const tokenAssets = assets.filter(asset => asset.type === 'token');
export const nftAssets = assets.filter(asset => asset.type === 'nft');