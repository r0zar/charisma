import supertest from "supertest";
import { describe, it, expect, jest, beforeAll } from "@jest/globals";
import { createServer } from "../server";
import { Dexterity } from "@repo/dexterity";

describe("Server", () => {
  let app: any;

  beforeAll(async () => {
    app = createServer();
    await Dexterity.discoverAndLoad()
  }, 50000);

  // Test basic endpoints
  it("health check returns 200", async () => {
    await supertest(app)
      .get("/status")
      .expect(200)
      .then((res) => {
        expect(res.ok).toBe(true);
      });
  });

  it("message endpoint says hello", async () => {
    await supertest(app)
      .get("/message/jared")
      .expect(200)
      .then((res) => {
        expect(res.body).toEqual({ message: "hello jared" });
      });
  });

  // Test Dexterity endpoints
  describe("Dexterity API", () => {
    it("should return status info", async () => {
      await supertest(app)
        .get("/api/dexterity/status")
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe("ok");
          expect(res.body.cacheStats).toBeDefined();
          expect(res.body.serverTime).toBeDefined();
        });
    });

    it("should return vaults", async () => {
      await supertest(app)
        .get("/api/dexterity/vaults")
        .expect(200)
        .then((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].contractId).toBeDefined();
        });
    });

    it("should return tokens", async () => {
      await supertest(app)
        .get("/api/dexterity/tokens")
        .expect(200)
        .then((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0].contractId).toBeDefined();
        });
    });

    it("should return a specific token", async () => {
      await supertest(app)
        .get("/api/dexterity/tokens/.stx")
        .expect(200)
        .then((res) => {
          expect(res.body.contractId).toBe(".stx");
          expect(res.body.symbol).toBe("STX");
        });
    });

    it("should handle a non-existent token", async () => {
      await supertest(app)
        .get("/api/dexterity/tokens/non-existent")
        .expect(404);
    });

    it("should trigger indexing", async () => {
      await supertest(app)
        .get("/api/dexterity/index")
        .expect(200)
        .then((res) => {
          expect(res.body.status).toBe("ok");
          expect(res.body.message).toBeDefined();
        });
    });

    it("should provide swap quotes", async () => {
      await supertest(app)
        .get("/api/dexterity/quote")
        .query({
          fromTokenId: ".stx",
          toTokenId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
          amount: "1000000"
        })
        .expect(200)
        .then((res) => {
          expect(res.body.amountIn).toBe(1000000);
          expect(res.body.amountOut).toBeDefined();
          expect(res.body.route).toBeDefined();
        });
    });

    it("should validate quote parameters", async () => {
      await supertest(app)
        .get("/api/dexterity/quote")
        .query({
          fromTokenId: ".stx",
          // Missing toTokenId and amount
        })
        .expect(400);
    });
  });
});
