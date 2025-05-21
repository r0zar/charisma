// built in tests to fix clean data
import { describe, expect, it } from "@jest/globals";
import { listTokens } from "@repo/tokens";
import { callReadOnly, getContractInfo } from "..";
import { kv } from "@vercel/kv";
import dotenv from "dotenv";
dotenv.config({ path: '../../.env' });
describe('data cleaning', () => {
    it('should fix missing decimals', async () => {
        const tokens = await listTokens();
        expect(tokens).toBeDefined();
        expect(tokens.length).toBeGreaterThan(0);
        // print out a list of all tokens missing a decimals property
        const missingDecimals = tokens.filter((token) => !token.decimals);
        console.log(missingDecimals.map((token) => token.contractId));
        // for each token lookup decimals on chain
        for (const token of missingDecimals) {
            console.log(`Fetching decimals for ${token.contractId}`);
            const decimals = await callReadOnly(token.contractId, "get-decimals", []);
            if (decimals?.value !== undefined) {
                console.log(decimals?.value);
                // update the token with the new decimals
                token.decimals = Number(decimals.value);
                // save the token
                console.log(token);
                await kv.set(`sip10:${token.contractId}`, token);
            } else {
                // delete from kv
                console.log(`Deleting ${token.contractId} from kv`);
                // remove from token-list:sip10
                await deleteFromCache(token.contractId);

            }
        }
    });

    it('should list missing identifier', async () => {
        const tokens = await listTokens();
        expect(tokens).toBeDefined();
        expect(tokens.length).toBeGreaterThan(0);
        // print out a list of all tokens missing an identifier property
        const missingIdentifier = tokens.filter((token) => !token.identifier && token.contractId !== '.stx');
        console.log(missingIdentifier.map((token) => token.contractId));
        // for each token lookup identifier on chain
        for (const token of missingIdentifier) {
            console.log(`Fetching identifier for ${token.contractId}`);
            const info = await getContractInfo(token.contractId);
            console.log(info?.abi)
        }
    });
});

it('should delete a contract from cache', async () => {
    await deleteFromCache('SPRZX4M2HHMJQCYZZHY3QTA8TRCNJVNXG8EPEV4C.doggo');
});

async function deleteFromCache(tokenId: string) {
    await kv.del(`sip10:${tokenId}`);
    const tokenList = await kv.get<string[]>('token-list:sip10');
    if (tokenList) {
        const newList = tokenList.filter((id) => id !== tokenId);
        await kv.set('token-list:sip10', newList);
    }
}
