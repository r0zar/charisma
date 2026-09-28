import { NextResponse, type NextRequest } from 'next/server';

/**
 * What a finished trade actually delivered, read from its transaction.
 * The router returns one {dx, dy} per hop: the first dx is what went in, the last dy is what came out.
 */
export async function GET(req: NextRequest) {
  const txid = req.nextUrl.searchParams.get('txid');
  if (!txid || !/^(0x)?[0-9a-f]{64}$/i.test(txid)) {
    return NextResponse.json({ error: 'A valid txid is required' }, { status: 400 });
  }
  const res = await fetch(`https://api.hiro.so/extended/v1/tx/${txid.startsWith('0x') ? txid : `0x${txid}`}`, {
    headers: process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {},
    cache: 'no-store',
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Transaction unavailable (${res.status})` }, { status: 502 });
  }
  const tx = (await res.json()) as { tx_status: string; burn_block_time_iso?: string; tx_result?: { repr: string } };
  if (tx.tx_status === 'pending') return NextResponse.json({ status: 'pending' });
  if (tx.tx_status !== 'success') return NextResponse.json({ status: 'failed' });

  const repr = tx.tx_result?.repr ?? '';
  const dx = [...repr.matchAll(/\(dx u(\d+)\)/g)];
  const dy = [...repr.matchAll(/\(dy u(\d+)\)/g)];
  if (!dx.length || !dy.length) {
    return NextResponse.json({ error: `Transaction ${txid} has no swap result` }, { status: 422 });
  }
  return NextResponse.json(
    { status: 'success', amountIn: dx[0][1], amountOut: dy[dy.length - 1][1], time: tx.burn_block_time_iso },
    // A confirmed transaction never changes
    { headers: { 'Cache-Control': 'public, s-maxage=86400, immutable' } },
  );
}
