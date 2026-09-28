import { NextResponse, type NextRequest } from 'next/server';
import { readTxSwap } from '@/lib/zesty/win';

/** What a finished trade actually delivered, read from its transaction. */
export async function GET(req: NextRequest) {
  const txid = req.nextUrl.searchParams.get('txid');
  if (!txid || !/^(0x)?[0-9a-f]{64}$/i.test(txid)) {
    return NextResponse.json({ error: 'A valid txid is required' }, { status: 400 });
  }
  try {
    const swap = await readTxSwap(txid);
    // A confirmed transaction never changes
    const headers = swap.status === 'success' ? { 'Cache-Control': 'public, s-maxage=86400, immutable' } : undefined;
    return NextResponse.json(swap, { headers });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
