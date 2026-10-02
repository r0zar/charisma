# blaze-sdk

Blaze is Charisma's signed-intent layer on Stacks: a wallet signs a SIP-018 message, and anyone can submit it to a
subnet token contract, which verifies it on-chain through `blaze-v1`. Full docs: https://docs.charisma.rocks/docs/blaze-api/introduction

```bash
npm install blaze-sdk
```

## Sign a triggered swap

```ts
import { signTriggeredSwap, MULTIHOP_CONTRACT_ID } from 'blaze-sdk';

// Lets the router (x-multihop-v1 by default) move 1 CHA from your subnet balance, once (the uuid is single-use).
// x-multihop-v1 always pays the output back to the signer.
const signature = await signTriggeredSwap({
  subnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
  uuid: crypto.randomUUID(),
  amount: 1_000_000n,
});
// POST it to https://swap.charisma.rocks/api/v1/orders/new (see the DEX API docs)
```

## Read a subnet balance

```ts
import { getUserTokenBalance } from 'blaze-sdk';

const { onChainBalance } = await getUserTokenBalance(
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
  'SP…your-address',
); // reads the token's get-balance on-chain; throws if the chain can't be read
```

## Signed requests

`signedFetch(url, { message })` and `signedFetchWithTimestamp(url, { message })` sign with the user's wallet and send
`x-signature` / `x-public-key` (and `x-timestamp`); `verifySignedRequest` and `verifySignedRequestWithTimestamp`
check them on the server.

## 2.0

2.0 replaces the 1.x message API. `getUserTokenBalance` now reads the chain directly and throws instead of returning
zeros; the retired `blaze.charisma.rocks` service is no longer used.

MIT licensed.
