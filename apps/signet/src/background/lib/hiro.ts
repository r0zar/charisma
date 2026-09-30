/**
 * fetch for Hiro's public API: when Hiro rate-limits (429), wait and retry a few times instead of failing.
 * Waits Retry-After when Hiro sends it, otherwise 1s, 2s, 4s.
 */
const RETRIES = 3

export async function hiroFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init)
    if (res.status !== 429 || attempt === RETRIES) return res
    const retryAfter = Number(res.headers.get("retry-after"))
    await new Promise(resolve => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt))
  }
}

/** Client option for @stacks/transactions calls (read-only calls, nonce and fee lookups, broadcasts) */
export const hiroClient = { baseUrl: "https://api.hiro.so", fetch: hiroFetch }
