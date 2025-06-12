import { FundingRequest, FundingOffer } from './p2p-schema';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';

const FUNDING_REQUESTS_HASH_KEY = 'p2p_funding_requests';

/**
 * Save a funding request to KV storage
 */
export async function saveFundingRequest(request: FundingRequest): Promise<void> {
    await kv.hset(FUNDING_REQUESTS_HASH_KEY, { [request.id]: JSON.stringify(request) });
    console.log(`💾 Saved funding request ${request.id} to KV storage`);
}

/**
 * Get a funding request by ID
 */
export async function getFundingRequest(id: string): Promise<FundingRequest | null> {
    try {
        const requestStr = await kv.hget(FUNDING_REQUESTS_HASH_KEY, id);
        if (!requestStr) {
            console.log(`📭 Funding request ${id} not found in KV storage`);
            return null;
        }

        const request = JSON.parse(requestStr as string) as FundingRequest;
        console.log(`📦 Retrieved funding request ${id} from KV storage`);
        return request;
    } catch (error) {
        console.error(`❌ Error retrieving funding request ${id}:`, error);
        return null;
    }
}

/**
 * Get all funding requests
 */
export async function getAllFundingRequests(): Promise<FundingRequest[]> {
    try {
        const requestsHash = await kv.hgetall(FUNDING_REQUESTS_HASH_KEY) || {};
        const requests = Object.values(requestsHash).map(requestStr =>
            JSON.parse(requestStr as string) as FundingRequest
        );

        console.log(`📦 Retrieved ${requests.length} funding requests from KV storage`);
        return requests;
    } catch (error) {
        console.error('❌ Error retrieving all funding requests:', error);
        return [];
    }
}

/**
 * Get funding requests by status
 */
export async function getFundingRequestsByStatus(status: FundingRequest['fundingStatus']): Promise<FundingRequest[]> {
    const allRequests = await getAllFundingRequests();
    return allRequests.filter(request => request.fundingStatus === status);
}

/**
 * Get funding requests by trader
 */
export async function getFundingRequestsByTrader(traderId: string): Promise<FundingRequest[]> {
    const allRequests = await getAllFundingRequests();
    return allRequests.filter(request => request.traderId === traderId);
}

/**
 * Get funding requests by funder
 */
export async function getFundingRequestsByFunder(funderId: string): Promise<FundingRequest[]> {
    const allRequests = await getAllFundingRequests();
    return allRequests.filter(request => request.funderId === funderId);
}

/**
 * Update funding request status
 */
export async function updateFundingRequestStatus(
    id: string,
    status: FundingRequest['fundingStatus']
): Promise<FundingRequest | null> {
    const request = await getFundingRequest(id);
    if (!request) return null;

    request.fundingStatus = status;

    if (status === 'funded') {
        request.fundedAt = Date.now();
    } else if (status === 'settled') {
        request.settledAt = Date.now();
    }

    await saveFundingRequest(request);
    console.log(`🔄 Updated funding request ${id} status to ${status}`);
    return request;
}

/**
 * Add funding offer to a request
 */
export async function addFundingOffer(
    requestId: string,
    offer: FundingOffer
): Promise<FundingRequest | null> {
    const request = await getFundingRequest(requestId);
    if (!request) return null;

    request.fundingOffers.push(offer);
    await saveFundingRequest(request);
    console.log(`💰 Added funding offer ${offer.fundingOfferId} to request ${requestId}`);
    return request;
}

/**
 * Update funding offer status
 */
export async function updateFundingOfferStatus(
    requestId: string,
    offerId: string,
    status: FundingOffer['status']
): Promise<FundingRequest | null> {
    const request = await getFundingRequest(requestId);
    if (!request) return null;

    const offer = request.fundingOffers.find(o => o.fundingOfferId === offerId);
    if (!offer) return null;

    offer.status = status;
    await saveFundingRequest(request);
    console.log(`🔄 Updated funding offer ${offerId} status to ${status}`);
    return request;
}

/**
 * Accept a funding offer
 */
export async function acceptFundingOffer(
    requestId: string,
    offerId: string,
    funderId: string
): Promise<FundingRequest | null> {
    const request = await getFundingRequest(requestId);
    if (!request) return null;

    // Mark the accepted offer
    const acceptedOffer = request.fundingOffers.find(o => o.fundingOfferId === offerId);
    if (!acceptedOffer) return null;

    acceptedOffer.status = 'accepted';

    // Reject all other offers
    request.fundingOffers.forEach(offer => {
        if (offer.fundingOfferId !== offerId && offer.status === 'pending') {
            offer.status = 'rejected';
        }
    });

    // Update request status
    request.fundingStatus = 'funded';
    request.funderId = funderId;
    request.fundedAt = Date.now();

    await saveFundingRequest(request);
    console.log(`✅ Accepted funding offer ${offerId} for request ${requestId}`);
    return request;
}

/**
 * Delete a funding request
 */
export async function deleteFundingRequest(id: string): Promise<boolean> {
    try {
        await kv.hdel(FUNDING_REQUESTS_HASH_KEY, id);
        console.log(`🗑️ Deleted funding request ${id} from KV storage`);
        return true;
    } catch (error) {
        console.error(`❌ Error deleting funding request ${id}:`, error);
        return false;
    }
} 