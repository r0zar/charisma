// === SIMPLIFIED ORACLE-ONLY ARCHITECTURE ===

// Shared utilities
export * from './shared/decimal-utils';

// Oracle Price Engine
export * from './engines/oracle-price-engine';

// Oracle adapters
export * from './oracles';

// Price series (storage layer)
export { SimpleBlobStorage } from './price-series/simple-blob-storage';
export {
    createBlobFromPriceResults,
    appendPricesToBlob,
    serializeBlobData,
    deserializeBlobData
} from './price-series/blob-builder';