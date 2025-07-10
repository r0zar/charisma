import { z } from 'zod';

/**
 * App metadata schema for runtime environment configuration
 * Replaces generator metadata with actual useful app configuration
 */
export const AppMetadataSchema = z.object({
  // Environment information
  environment: z.enum(['development', 'staging', 'production']),
  
  // Data loading configuration
  loadingConfig: z.string().optional(),
  
  // API configuration
  apiBaseUrl: z.string(),
  apiTimeout: z.number().int().positive(),
  
  // Cache configuration
  cacheEnabled: z.boolean(),
  cacheTtl: z.number().int().positive(),
  
  // Debug configuration
  debugDataLoading: z.boolean(),
  logDataSources: z.boolean(),
  
  // Feature flags
  featureFlags: z.object({
    enableApiMetadata: z.boolean(),
    enableApiUser: z.boolean(),
    enableApiBots: z.boolean(),
    enableApiMarket: z.boolean(),
    enableApiNotifications: z.boolean(),
  }),
  
  // Runtime information
  isServer: z.boolean(),
  isClient: z.boolean(),
  timestamp: z.string().datetime(),
});

/**
 * State validation result schema for app state validation
 */
export const StateValidationResultSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  validationErrors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  metadata: z.object({
    environment: z.string(),
    validatedAt: z.string().datetime(),
    dataSize: z.number().int().min(0),
  }).optional(),
});

// Infer TypeScript types from schemas
export type AppMetadata = z.infer<typeof AppMetadataSchema>;
export type StateValidationResult = z.infer<typeof StateValidationResultSchema>;