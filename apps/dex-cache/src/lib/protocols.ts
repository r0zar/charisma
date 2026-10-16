/** The DEX behind each vault, keyed by its `protocol`: the name people know it by, and its team's icon */
const DEXES: Record<string, { name: string; icon?: string }> = {
    CHARISMA: { name: 'Charisma', icon: '/dex/charisma.png' },
    BITFLOW: { name: 'Bitflow', icon: '/dex/bitflow.svg' },
    ALEX: { name: 'ALEX', icon: '/dex/alex.png' },
    ARKADIKO: { name: 'Arkadiko', icon: '/dex/arkadiko.png' },
    VELAR: { name: 'Velar', icon: '/dex/velar.png' },
    FAKTORY: { name: 'fak.fun', icon: '/dex/fakfun.png' },
};

export const dexOf = (protocol: string) => DEXES[protocol] ?? { name: protocol };
