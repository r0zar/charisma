import { NextResponse } from 'next/server';
import { getOrder, fillOrder } from '@/lib/orders/store';
import { LimitOrder } from '@/lib/orders/types';
import { getQuote } from '@/app/actions';

async function executeTrade(order: LimitOrder): Promise<string> {
    // fetch quote to build hops
    const quoteRes = await getQuote(order.inputToken, order.outputToken, order.amountIn);
    if (!quoteRes.success || !quoteRes.data) {
        throw new Error('Failed to fetch route');
    }

    const tx = await (await import('@/lib/dexterity-client')).Dexterity.buildXSwapTransaction(
        quoteRes.data.route,
        {
            amountIn: order.amountIn,
            signature: order.signature,
            uuid: order.uuid,
            recipient: order.recipient,
        }
    );

    const payload = {
        tx,
        signature: order.signature,
        uuid: order.uuid,
    };

    const url = `${process.env.SIGNER_URL ?? 'http://localhost:3005'}/api/multihop/execute`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Signer returned ${res.status}`);
    }

    const data = (await res.json()) as { txid: string };
    return data.txid;
}

export async function POST(_req: Request, { params }: { params: { uuid: string } }) {
    try {
        const { uuid } = await params;
        const order = await getOrder(uuid);
        if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (order.status !== 'open') return NextResponse.json({ error: 'Order not open' }, { status: 400 });

        const txid = await executeTrade(order);
        await fillOrder(order.uuid, txid);
        return NextResponse.json({ status: 'success', txid });
    } catch (err) {
        console.error('Execute order error', err);
        return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
    }
} 