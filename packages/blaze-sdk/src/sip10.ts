import { callReadOnlyFunction, fetchStxBalance } from "@repo/polyglot";
import { principalCV } from "@stacks/transactions";

export async function fetchTokenBalance(tokenContractId: string, address: string): Promise<number> {
    try {
        if (tokenContractId === '.stx') {
            return await fetchStxBalance(address);
        } else {
            const [addr, name] = tokenContractId.split('.');
            const balanceCV = await callReadOnlyFunction(addr, name, 'get-balance', [principalCV(address)]);
            return Number(balanceCV.value);
        }
    } catch (error) {
        console.error(`Failed fetching token balance for ${tokenContractId}:`, error);
        return 0;
    }
}

export async function fetchTotalSupply(vaultContractId: string): Promise<number> {
    try {
        const [addr, name] = vaultContractId.split('.');
        const supplyCV = await callReadOnlyFunction(addr, name, 'get-total-supply', []);
        return Number(supplyCV.value);
    } catch (error) {
        console.error(`Failed fetching total supply for ${vaultContractId}:`, error);
        return 0;
    }
}