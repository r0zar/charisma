import { describe, expect, it } from 'vitest';
import { getAddressFromPrivateKey, privateKeyToPublic, randomPrivateKey, signMessageHashRsv } from '@stacks/transactions';
import { hashMessage } from '@stacks/encryption';
import { replyMessage, replySigner } from './reply-auth';

/** A request signed the way blaze-sdk signedFetchWithTimestamp signs it */
function signed(message: string, key: string, timestamp = Date.now()) {
    const payload = JSON.stringify({ message, timestamp });
    const signature = signMessageHashRsv({ messageHash: Buffer.from(hashMessage(payload)).toString('hex'), privateKey: key });
    return new Request('https://tx.charisma.rocks/api/v1/activities/a/replies', {
        method: 'POST',
        headers: { 'x-signature': signature, 'x-public-key': privateKeyToPublic(key), 'x-timestamp': String(timestamp) },
    });
}

describe('reply signatures', () => {
    const key = randomPrivateKey();
    const me = getAddressFromPrivateKey(key, 'mainnet');

    it('names the wallet that signed the reply', async () => {
        const auth = await replySigner(signed(replyMessage.add('act-1', 'gm'), key), replyMessage.add('act-1', 'gm'));
        expect(auth).toEqual({ signer: me });
    });

    it('refuses a signature made for other words', async () => {
        const auth = await replySigner(signed(replyMessage.add('act-1', 'gm'), key), replyMessage.add('act-1', 'rug'));
        expect('denied' in auth && auth.denied.status).toBe(401);
    });

    it('refuses a signature made for another reply or action', async () => {
        const auth = await replySigner(signed(replyMessage.remove('reply-1'), key), replyMessage.remove('reply-2'));
        expect('denied' in auth && auth.denied.status).toBe(401);
    });

    it('refuses a stale signature', async () => {
        const old = Date.now() - 6 * 60 * 1000;
        const auth = await replySigner(signed(replyMessage.edit('reply-1', 'hi'), key, old), replyMessage.edit('reply-1', 'hi'));
        expect('denied' in auth && auth.denied.status).toBe(401);
    });

    it('refuses an unsigned request', async () => {
        const auth = await replySigner(new Request('https://tx.charisma.rocks/x', { method: 'DELETE' }), replyMessage.remove('reply-1'));
        expect('denied' in auth && auth.denied.status).toBe(401);
    });
});
