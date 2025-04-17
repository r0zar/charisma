import { Router } from "express";
import { BlazeController } from "../controllers/blaze.controller";
// import { BlazeService } from "../services/blaze.service";

/**
 * Create Express router for Blaze API endpoints
 */
export const createBlazeRouter = (): Router => {
  // Create the router
  const router = Router();

  // Register routes

  // Status endpoint
  router.get("/status", BlazeController.getStatus);

  // Submit endpoint
  router.post("/submit", BlazeController.submitTransaction);

  return router;
};