/** The name people know each DEX by, keyed by a vault's `protocol` */
const DEX_NAMES: Record<string, string> = {
    CHARISMA: 'Charisma',
    BITFLOW: 'Bitflow',
    ALEX: 'ALEX',
    ARKADIKO: 'Arkadiko',
    VELAR: 'Velar',
    FAKTORY: 'fak.fun',
};

export const dexName = (protocol: string) => DEX_NAMES[protocol] ?? protocol;
