import { PerpetualPosition, NewPerpetualPositionRequest } from './types';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';

const PERPS_HASH_KEY = 'perpetual_positions'; // Redis hash for perp positions

export async function addPosition(req: NewPerpetualPositionRequest): Promise<PerpetualPosition> {
    const position: PerpetualPosition = {
        ...req,
        status: 'pending',
        createdAt: new Date().toISOString(),
        totalFundingFees: '0',
        lastFundingUpdate: new Date().toISOString(),
    };

    await kv.hset(PERPS_HASH_KEY, { [position.uuid]: JSON.stringify(position) });
    return position;
}

export async function getPosition(uuid: string): Promise<PerpetualPosition | undefined> {
    const raw = await kv.hget(PERPS_HASH_KEY, uuid);
    if (!raw) return undefined;
    return typeof raw === 'string' ? JSON.parse(raw) as PerpetualPosition : raw as PerpetualPosition;
}

export async function listPositions(owner?: string): Promise<PerpetualPosition[]> {
    const map = await kv.hgetall<Record<string, unknown>>(PERPS_HASH_KEY);
    const all: PerpetualPosition[] = map ?
        Object.values(map).map(v => typeof v === 'string' ? JSON.parse(v) : v) as PerpetualPosition[] : [];
    return owner ? all.filter(p => p.owner === owner) : all;
}

export async function updatePosition(position: PerpetualPosition): Promise<void> {
    await kv.hset(PERPS_HASH_KEY, { [position.uuid]: JSON.stringify(position) });
}

export async function triggerPosition(uuid: string, entryPrice: string): Promise<PerpetualPosition | undefined> {
    const position = await getPosition(uuid);
    if (!position || position.status !== 'pending') return undefined;

    position.status = 'open';
    position.entryPrice = entryPrice;
    position.entryTimestamp = new Date().toISOString();

    await updatePosition(position);
    return position;
}

export async function closePosition(
    uuid: string,
    closePrice: string,
    closeReason: PerpetualPosition['closeReason']
): Promise<PerpetualPosition | undefined> {
    const position = await getPosition(uuid);
    if (!position || position.status !== 'open') return undefined;

    position.status = 'closed';
    position.closePrice = closePrice;
    position.closeReason = closeReason;
    position.closeTimestamp = new Date().toISOString();

    await updatePosition(position);
    return position;
}

export async function updateFundingFees(uuid: string, additionalFees: string): Promise<void> {
    const position = await getPosition(uuid);
    if (!position) return;

    const currentFees = parseFloat(position.totalFundingFees);
    const newFees = parseFloat(additionalFees);

    position.totalFundingFees = (currentFees + newFees).toString();
    position.lastFundingUpdate = new Date().toISOString();

    await updatePosition(position);
}

export async function cancelPosition(uuid: string): Promise<PerpetualPosition | undefined> {
    const position = await getPosition(uuid);
    if (!position) return undefined;

    // Handle both pending and open positions
    if (position.status === 'pending' || position.status === 'open') {
        const wasOpen = position.status === 'open';

        position.status = 'closed';
        position.closeReason = 'manual';
        position.closeTimestamp = new Date().toISOString();

        // For open positions, we should set a close price if available
        if (wasOpen && position.entryPrice) {
            // Use entry price as close price for manual closes (could be improved with real market price)
            position.closePrice = position.entryPrice;
        }

        await updatePosition(position);
    }
    return position;
} 