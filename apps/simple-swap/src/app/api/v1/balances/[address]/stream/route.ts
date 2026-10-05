import { validateStacksAddress } from '@stacks/transactions';
import { listen } from '@/lib/balance-sheet/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Close a little before the platform would, so the browser reconnects cleanly (EventSource does it on its own) */
const LIFETIME_MS = 280_000;
/** A comment now and then keeps proxies from closing a quiet stream */
const PING_MS = 15_000;

/**
 * GET /api/v1/balances/{address}/stream
 * Server-sent events: `sheet` with the full balance sheet (the same shape as /sheet) when the stream opens and
 * whenever it changes, `problem` when the balances couldn't be read (the stream stays open and tries again).
 */
export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    if (!validateStacksAddress(address)) {
        return Response.json({ error: 'Invalid address', message: `${address} is not a Stacks address` }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let open = true;
            const write = (text: string) => {
                if (open) controller.enqueue(encoder.encode(text));
            };
            const stop = listen(address, {
                sheet: sheet => write(`event: sheet\ndata: ${JSON.stringify(sheet)}\n\n`),
                problem: message => write(`event: problem\ndata: ${JSON.stringify({ message })}\n\n`),
            });
            const ping = setInterval(() => write(': ping\n\n'), PING_MS);
            const close = () => {
                if (!open) return;
                open = false;
                stop();
                clearInterval(ping);
                clearTimeout(end);
                controller.close();
            };
            const end = setTimeout(close, LIFETIME_MS);
            request.signal.addEventListener('abort', close);
            write('retry: 1000\n\n');
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
            // Balances are public on the chain, so any site may stream them
            'Access-Control-Allow-Origin': '*',
        },
    });
}
