/** Public URL the metadata service serves a contract's token metadata from. */
export const hostedMetadataUrl = (contractId: string) =>
    `https://metadata.charisma.rocks/api/v1/metadata/${contractId}`;
