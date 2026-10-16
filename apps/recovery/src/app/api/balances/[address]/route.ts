import { NextResponse } from 'next/server';
import { iouBalances } from '@/lib/state';

/** GET /api/balances/{address} — a wallet's iouWELSH, iouROO and synSTX balances, in base units */
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^S[PM][0-9A-Z]{38,40}$/.test(address)) return NextResponse.json({ error: 'That is not a Stacks address' }, { status: 400 });
  try {
    return NextResponse.json(await iouBalances(address), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
