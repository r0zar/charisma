import { Request, Response } from "express";
import { BlazeService } from "../services/blaze.service";
import { log } from "@repo/logger";

/**
 * Controller for Blaze-related API endpoints
 */
export const BlazeController = {

  /**
   * Get service status and cache information
   */
  getStatus: async (req: Request, res: Response) => {
    try {
      const data = BlazeService.getStatus();

      res.json({
        status: 'ok',
        data,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      log(`Error in getStatus: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  submitTransaction: async (req: Request, res: Response) => {
    try {
      const data = BlazeService.submitTransaction();

      res.json({
        status: 'ok',
        data,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      log(`Error in submitTransaction: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}