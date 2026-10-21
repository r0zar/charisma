/** The protocol behind each vault (a DEX, or a staking protocol like StackingDAO), keyed by its `protocol`: the name
 * people know it by, and its team's icon */
const PROTOCOLS: Record<string, { name: string; icon?: string }> = {
    CHARISMA: { name: 'Charisma', icon: '/dex/charisma.png' },
    BITFLOW: { name: 'Bitflow', icon: '/dex/bitflow.svg' },
    ALEX: { name: 'ALEX', icon: '/dex/alex.png' },
    ARKADIKO: { name: 'Arkadiko', icon: '/dex/arkadiko.png' },
    VELAR: { name: 'Velar', icon: '/dex/velar.png' },
    FAKTORY: { name: 'fak.fun', icon: '/dex/fakfun.png' },
    STACKINGDAO: { name: 'StackingDAO', icon: '/dex/stackingdao.png' },
    HERMETICA: { name: 'Hermetica', icon: '/dex/hermetica.png' },
};

export const protocolOf = (protocol: string) => PROTOCOLS[protocol] ?? { name: protocol };
