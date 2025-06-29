import { describe, it, expect } from 'vitest';
import { addOrder, getOrder, listOrders, cancelOrder } from './store';
import { NewOrderRequest } from './types';

// Ensure KV credentials exist
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn('⚠️  KV env variables not set - skipping order store tests');
    describe.skip('orders store (kv)', () => {
        it('skipped', () => {
            expect(true).toBe(true);
        });
    });
} else {
    describe('orders store (kv)', () => {
        const baseReq: NewOrderRequest = {
            owner: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            inputToken: 'SPTOKENA.subnet-a',
            outputToken: 'SPTOKENB.token-b',
            amountIn: '1000',
            targetPrice: '500',
            direction: 'gt',
            conditionToken: 'SPTOKENB.token-b',
            signature: 'a'.repeat(130),
            uuid: crypto.randomUUID(),
            recipient: 'SPTESTOWNER111111111111111111111111111111111',
        };

        let orderId: string;

        it('adds order', async () => {
            const created = await addOrder(baseReq);
            console.log('created', created);
            orderId = created.uuid;
            expect(created.uuid).toBe(baseReq.uuid);
            expect(created.status).toBe('open');
        });

        it('gets order', async () => {
            const fetched = await getOrder(orderId);
            console.log('fetched', fetched);
            expect(fetched?.uuid).toBe(orderId);
        });

        it('lists orders', async () => {
            const list = await listOrders(baseReq.owner);
            console.log('list', list);
            expect(list.map(o => o.uuid)).toContain(orderId);
        });

        it('cancels order', async () => {
            const cancelled = await cancelOrder(orderId);
            console.log('cancelled', cancelled);
            expect(cancelled?.status).toBe('cancelled');
        });
    });
} 