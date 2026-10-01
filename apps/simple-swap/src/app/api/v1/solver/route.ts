import { NextResponse } from 'next/server';
import { BLAZE_SOLVER_ADDRESS } from '@/lib/constants';

/** The solver pays every signed trade's network fee; its STX balance is what keeps trades running. */
export async function GET() {
  const res = await fetch(`https://api.hiro.so/extended/v1/address/${BLAZE_SOLVER_ADDRESS}/stx`, {
    headers: process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {},
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    return NextResponse.json({ error: `Solver balance unavailable (${res.status})` }, { status: 502 });
  }
  const { balance } = (await res.json()) as { balance: string };
  return NextResponse.json(
    { address: BLAZE_SOLVER_ADDRESS, stx: Number(balance) / 1e6 },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
