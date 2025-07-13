/**
 * Client-Safe Bot Services
 * 
 * This file exports only client-safe functionality from the bots services.
 * Use this in client components instead of importing from the main index.
 */

// Client-safe exports only
export * from './core/bot-state-machine';
export * from './execution/execution-log-service';
export * from './sandbox/sandbox-client';

// Types are always safe to import
export type * from '../../../schemas/bot.schema';
export type * from '../../../schemas/sandbox.schema';