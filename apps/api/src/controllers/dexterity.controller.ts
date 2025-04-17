import { Request, Response } from "express";
import { DexterityService } from "../services/dexterity.service";
import { log } from "@repo/logger";

/**
 * Controller for Dexterity-related API endpoints
 */
export class DexterityController {
  private service: DexterityService;

  constructor(service: DexterityService) {
    this.service = service;
  }

  /**
   * Get service status and cache information
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = this.service.getCacheStats();

      res.json({
        status: 'ok',
        cacheStats: stats,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      log(`Error in getStatus: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Manually trigger data indexing
   */
  triggerIndexing = async (req: Request, res: Response): Promise<void> => {
    try {
      // Start indexing in the background
      this.service.indexData().catch(err => {
        log(`Background indexing error: ${err}`);
      });

      res.json({
        status: 'ok',
        message: 'Indexing started in the background'
      });
    } catch (error) {
      log(`Error triggering indexing: ${error}`);
      res.status(500).json({ error: 'Failed to trigger indexing' });
    }
  };

  /**
   * Get all vaults
   */
  getVaults = async (req: Request, res: Response): Promise<void> => {
    try {
      const vaults = this.service.getVaults();

      // Optional filtering by token
      const tokenId = req.query.tokenId as string | undefined;

      if (tokenId) {
        const filteredVaults = this.service.getVaultsWithToken(tokenId);
        res.json(filteredVaults);
      } else {
        res.json(vaults);
      }
    } catch (error) {
      log(`Error getting vaults: ${error}`);
      res.status(500).json({ error: 'Failed to get vaults' });
    }
  };

  /**
   * Get all tokens
   */
  getTokens = async (req: Request, res: Response): Promise<void> => {
    try {
      const tokens = this.service.getTokens();

      // Optional filtering by symbol
      const symbol = req.query.symbol as string | undefined;

      if (symbol) {
        const filteredTokens = tokens.filter(t =>
          t.symbol.toLowerCase().includes(symbol.toLowerCase())
        );
        res.json(filteredTokens);
      } else {
        res.json(tokens);
      }
    } catch (error) {
      log(`Error getting tokens: ${error}`);
      res.status(500).json({ error: 'Failed to get tokens' });
    }
  };

  /**
   * Get a token by ID
   */
  getToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const tokenId = req.params.tokenId;
      const token = this.service.getToken(tokenId);

      if (token) {
        res.json(token);
      } else {
        res.status(404).json({ error: 'Token not found' });
      }
    } catch (error) {
      log(`Error getting token: ${error}`);
      res.status(500).json({ error: 'Failed to get token' });
    }
  };

  /**
   * Get a quote for swapping tokens
   */
  getQuote = async (req: Request, res: Response): Promise<void> => {
    try {
      const fromTokenId = req.query.fromTokenId as string;
      const toTokenId = req.query.toTokenId as string;
      const amountStr = req.query.amount as string;

      // Validate parameters
      if (!fromTokenId || !toTokenId || !amountStr) {
        res.status(400).json({
          error: 'Missing required parameters: fromTokenId, toTokenId, amount'
        });
        return;
      }

      // Parse amount
      const amount = parseInt(amountStr, 10);

      if (isNaN(amount) || amount <= 0) {
        res.status(400).json({ error: 'Invalid amount parameter' });
        return;
      }

      // Get quote
      const quote = await this.service.getQuote(fromTokenId, toTokenId, amount);

      if (quote instanceof Error) {
        res.status(400).json({
          error: quote.message || 'Failed to get quote'
        });
      } else {
        res.json(quote);
      }
    } catch (error) {
      log(`Error getting quote: ${error}`);
      res.status(500).json({ error: 'Failed to get quote' });
    }
  };
}