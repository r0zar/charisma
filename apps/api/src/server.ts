import { json, urlencoded } from "body-parser";
import express, { type Express } from "express";
import morgan from "morgan";
import cors from "cors";
import { createDexterityRouter } from "./routes/dexterity.routes";
import { createBlazeRouter } from "./routes/blaze.routes";

export const createServer = (): Express => {
  const app = express();

  // Set up middleware
  app
    .disable("x-powered-by")
    .use(morgan("dev"))
    .use(urlencoded({ extended: true }))
    .use(json())
    .use(cors());

  // Basic routes
  app
    .get("/message/:name", (req, res) => {
      return res.json({ message: `hello ${req.params.name}` });
    })
    .get("/status", (_, res) => {
      return res.json({ ok: true });
    });

  // Mount the Dexterity API router
  // Configure with router address if needed for multi-hop swaps
  const dexterityRouter = createDexterityRouter({
    // Router contract details (if needed)
    routerAddress: process.env.ROUTER_ADDRESS || undefined,
    routerName: process.env.ROUTER_NAME || undefined,
    // Update cache every 15 minutes
    updateIntervalMs: 15 * 60 * 1000
  });

  const blazeRouter = createBlazeRouter()

  app.use("/api/dexterity", dexterityRouter);

  app.use("/api/blaze", blazeRouter);

  return app;
};
