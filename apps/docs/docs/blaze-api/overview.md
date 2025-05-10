---
slug: overview
sidebar_position: 1
title: API Overview
---

# Blaze API (v1)

Blaze is Charisma's execution layer: a cluster of highly-available solvers that accept signed intents, build the necessary Clarity transactions based on the intent and live oracle data, and submit them to the Stacks network on your behalf.

> Base URL (production): `https://blaze.charisma.rocks/api/v1`
>
> Unless otherwise noted, all endpoints accept and return `application/json`.

## Versioning

Stable endpoints are prefixed with `/api/v1` and follow semantic versioning. Breaking changes will bump the major (`v1 → v2`).

## Authorization

All Blaze endpoints are publicly accessible. However, to execute an action, a valid **signature** is required, corresponding to the owner of the assets involved in the submitted intent.

- The intent (typically identified by a `uuid` and containing action-specific `params`) must be signed using the private key of the Stacks account that will grant authorization to allow the operation executed on their behalf.
- The 65-byte compressed signature (hex, no `0x`) must be included in the `signature` field of the request body.

While the API itself is open, only a party possessing a valid signature for a given intent can have Blaze execute that specific action. Signed intents can be considered bearer assets: anyone holding a valid signed intent can submit it to Blaze.

## Error model

Every error shares the same shape:

```json
{
  "success": false,
  "error": "Human-readable message"
}
```

`HTTP` status codes follow standard semantics (`400` = bad request, `401/403` = auth failure, `500` = server error).

---

## Endpoints

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `POST` | `/execute` | Public (Signature required) | Execute a signed intent for a generic operation on a Blaze-compatible subnet (e.g., token transfers via `charisma-token-subnet`). |
| `POST` | `/multihop/execute` | Public (Signature required) | Execute a signed intent for a chained / multi-hop swap route. |

The detailed reference for each route lives below. 