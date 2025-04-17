/**
 * Blaze SDK - Message-centric blockchain state management
 * Main exports for the library
 */

// Core interfaces
export type { QueryIntent, MutateIntent, QueryResult, MutateResult, } from './lib/intent';

// Service interface
export { type Service, type ServiceOptions, createService } from './lib/service';

// Cache
export { MemoryCache, type CacheOptions } from './lib/memory-cache';

// Processor
export { Processor, type ProcessorOptions } from './lib/processor';

// Message signing
export { MessageSigner } from './lib/message-signer';

// Stacks service / client
export { StacksService, createStacksService } from './services/stacks-service'

// Main client exports
export { Blaze, createBlazeClient } from './lib/blaze';
