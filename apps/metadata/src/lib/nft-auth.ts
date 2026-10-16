import { verifySignedRequestWithTimestamp } from 'blaze-sdk';

export const CONTRACT_ID = /^S[PM][A-Z0-9]{38,40}\.[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;

/**
 * Only the contract's deployer may change its collection: they sign {message: contractId, timestamp}.
 * One signature covers a whole upload, so it stays valid for 30 minutes.
 */
export function verifyCollectionOwner(request: Request, contractId: string) {
    return verifySignedRequestWithTimestamp(request, {
        message: contractId,
        expectedAddress: contractId.split('.')[0],
        ttl: 30,
    });
}
