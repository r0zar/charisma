import { NextResponse, type NextRequest } from 'next/server';
import { createWin } from '@/lib/zesty/win';

/** Lock in a winning trade's result so it can be shared. Anyone may call it: the result comes from the chain. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  try {
    return NextResponse.json(await createWin(uuid));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
