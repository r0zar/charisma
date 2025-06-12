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
        const requestData = await kv.hget(FUNDING_REQUESTS_HASH_KEY, id);
        if (!requestData) {
            console.log(`📭 Funding request ${id} not found in KV storage`);
            return null;
        }

        let request: FundingRequest;

        if (typeof requestData === 'string') {
            // Parse JSON string
            request = JSON.parse(requestData) as FundingRequest;
        } else if (typeof requestData === 'object' && requestData !== null) {
            // Handle legacy object storage
            request = requestData as FundingRequest;
            // Re-save as JSON string to fix storage format
            await saveFundingRequest(request);
        } else {
            console.error(`❌ Invalid funding request data type for ${id}:`, typeof requestData);
            return null;
        }

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
        const requests: FundingRequest[] = [];

        for (const [key, value] of Object.entries(requestsHash)) {
            try {
                let request: FundingRequest;

                if (typeof value === 'string') {
                    // Try to parse as JSON string
                    request = JSON.parse(value) as FundingRequest;
                } else if (typeof value === 'object' && value !== null) {
                    // Handle legacy object storage
                    request = value as FundingRequest;
                    // Re-save as JSON string to fix storage format
                    await saveFundingRequest(request);
                } else {
                    console.warn(`⚠️ Skipping invalid funding request data for key ${key}:`, value);
                    continue;
                }

                requests.push(request);
            } catch (parseError) {
                console.error(`❌ Failed to parse funding request ${key}:`, parseError, 'Raw value:', value);
                // Skip this invalid entry but continue with others
                continue;
            }
        }

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