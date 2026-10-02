/** The link a player shares: the game, with their referral code when they have one. */
export async function shareLink(address?: string | null): Promise<string> {
    const origin = window.location.origin;
    if (!address) return origin;
    const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats', userId: address }),
    });
    if (!res.ok) return origin; // no code yet, or the referral service is down: the plain link still works
    const result = await res.json();
    const code = result?.data?.referralCodes?.[0]?.code;
    return code ? `${origin}?ref=${encodeURIComponent(code)}` : origin;
}

export const pickMessage = (symbol: string) =>
    `I just backed $${symbol} on Meme Roulette 🎰 Everyone's CHA goes in one pot, the wheel picks a meme, and the whole pot pumps it. Back yours:`;
