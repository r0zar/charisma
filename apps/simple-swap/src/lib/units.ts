/** A typed decimal amount in smallest units, exactly; anything unreadable is zero */
export function toUnits(text: string, decimals: number): bigint {
    const match = text.trim().match(/^(\d*)(?:\.(\d*))?$/);
    if (!match || (!match[1] && !match[2])) return 0n;
    const fraction = (match[2] ?? '').slice(0, decimals).padEnd(decimals, '0');
    return BigInt((match[1] || '0') + fraction);
}

/** Smallest units as a plain decimal, for the amount box */
export function fromUnits(raw: bigint, decimals: number): string {
    const text = raw.toString().padStart(decimals + 1, '0');
    const whole = text.slice(0, text.length - decimals);
    const fraction = text.slice(text.length - decimals).replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole;
}
