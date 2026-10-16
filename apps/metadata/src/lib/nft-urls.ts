/** The base URI a contract points at: token metadata is `<base><id>.json`, images `<base><field>/<file>` */
export const nftBaseUri = (slug: string) => `https://metadata.charisma.rocks/nft/${slug}/`;
