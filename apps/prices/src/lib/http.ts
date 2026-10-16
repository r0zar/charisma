import { NextResponse } from 'next/server';

const CORS = { 'Access-Control-Allow-Origin': '*' };

/** JSON for anyone to read, cached at the edge for `seconds` and served stale while it refreshes */
export const ok = (data: unknown, seconds: number) =>
  NextResponse.json(data, { headers: { ...CORS, 'Cache-Control': `public, max-age=${Math.min(seconds, 60)}, s-maxage=${seconds}, stale-while-revalidate=${seconds * 10}` } });

/** An error that explains itself; never cached */
export const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });

/** Turns a thrown error into a response: bad input is the caller's fault (400), anything else is ours (500) */
export function failed(e: unknown) {
  if (e instanceof RangeError) return fail(400, e.message);
  console.error(e);
  return fail(500, e instanceof Error ? e.message : String(e));
}

/** A time from a query param: ISO date or unix seconds */
export function parseTime(name: string, value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = /^\d+$/.test(value) ? new Date(Number(value) * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`${name} must be an ISO date or unix seconds, got "${value}"`);
  return date;
}
