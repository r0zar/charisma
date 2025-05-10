---
slug: api-technical-summary
sidebar_position: 2
title: API Overview
---

# Charisma DEX API (v1)

The Charisma DEX exposes a minimal set of HTTP endpoints so anyone can fetch live pricing data, create off-chain orders, and execute trades on the Stacks network.

> Base URL (production): `https://swap.charisma.rocks/api/v1`
>
> Unless otherwise noted, all endpoints accept and return `application/json`.

## Versioning

All stable endpoints are prefixed with `/api/v1`.

## Authorization

Read-only endpoints (`GET` requests) are public—no credential required.

For state-changing endpoints (`POST`, `PATCH`, etc.):

*   The `/orders/new` endpoint is **publicly accessible** but requires a valid **signature** corresponding to the owner of the assets for the order being created. This signature proves authorship of the order (intent). Signed orders can be considered bearer assets: anyone holding a valid signed order can submit it. Developer API keys are **not** supported for `/orders/new`.

*   Other state-changing endpoints (e.g., `/orders/{uuid}/cancel`, `/orders/{uuid}/execute`) must prove the caller is authorised using **one** of the following:

    1.  **Signature** (recommended)
        •   Sign a deterministic message (usually a UUID or the JSON payload) with the private key that controls the relevant account.
        •   Include the 65-byte compressed signature (hex, no `0x`) in the request body or `Authorization` header as documented per route.

    2.  **Developer API key**
        •   Pass `x-api-key: <token>` in the headers. Keys are issued by Charisma so external services (bots, oracles, backend apps) can create or manage orders programmatically.

If an API key is supplied for endpoints that support it, signature verification is skipped.

Each endpoint specifies which method(s) it accepts.

## Error model

Every error response follows the same shape:

```json
{
  "success": false,
  "error": "Human-readable message"
}
```

HTTP status codes follow standard semantics (400 = bad request, 401/403 = auth failure, 500 = server error).

---

## Endpoints

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `GET` | `/quote` | Public | Calculate best route & output amount for a token pair |
| `GET` | `/orders` | Public | List limit orders (optional owner filter) |
| `POST` | `/orders/new` | Public (Signature required) | Create a new limit/triggered order |
| `GET` | `/orders/{uuid}` | Public | Fetch a single order by its UUID |
| `PATCH` | `/orders/{uuid}/cancel` | Signature **or** API key | Cancel an open order |
| `POST` | `/orders/{uuid}/execute` | Signature **or** API key | Force immediate execution | 