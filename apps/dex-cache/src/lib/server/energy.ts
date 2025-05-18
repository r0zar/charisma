'use server'

import { getAllVaultData, Vault } from "../vaultService";

// Updated function to fetch vaults from the API
export async function fetchHoldToEarnVaults(): Promise<Vault[]> {
    // getAllVaultData with type=ENERGY
    return getAllVaultData({ type: 'ENERGY' });
}