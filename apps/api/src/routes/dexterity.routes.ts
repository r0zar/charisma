import { Router } from "express";
import { DexterityController } from "../controllers/dexterity.controller";
import { DexterityService } from "../services/dexterity.service";

/**
 * Create Express router for Dexterity API endpoints
 */
export const createDexterityRouter = (options?: {
  routerAddress?: string;
  routerName?: string;
  updateIntervalMs?: number;
}): Router => {
  // Create the router
  const router = Router();

  // Get singleton service instance
  const service = DexterityService.getInstance(options);

  // Create controller
  const controller = new DexterityController(service);

  // Register routes

  // Status endpoint
  router.get("/status", controller.getStatus);

  // Manual indexing trigger
  router.get("/index", controller.triggerIndexing);

  // Vaults endpoints
  router.get("/vaults", controller.getVaults);

  // Tokens endpoints
  router.get("/tokens", controller.getTokens);
  router.get("/tokens/:tokenId", controller.getToken);

  // Quotes endpoint
  router.get("/quote", controller.getQuote);

  return router;
};