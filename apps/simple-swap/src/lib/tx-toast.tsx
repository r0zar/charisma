import { toast } from 'sonner';
import { NotConfirmedYet, waitForConfirmation } from '@/lib/zesty/subnet';

export type TxStage = 'sent' | 'confirmed' | 'failed' | 'waiting';
/** What a transaction's pop-up says at each stage: a title and one line */
export type TxWords = Record<TxStage, [string, string]>;

/** One pop-up per transaction, updated in place from sent to its end, with a button to see it on the explorer */
export function txToast(txid: string, stage: TxStage, words: TxWords) {
    const [title, detail] = words[stage];
    const body = (
        <div className="flex flex-col gap-1">
            <div className="font-semibold text-foreground">{title}</div>
            <div className="text-muted-foreground text-sm">{detail}</div>
            <a
                href={`https://explorer.hiro.so/txid/${txid}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block button-primary px-3 py-1.5 text-xs rounded-lg font-medium mt-1 w-fit"
            >
                View on explorer
            </a>
        </div>
    );
    const options = { id: `tx-${txid}`, duration: stage === 'sent' ? Infinity : 7000 };
    if (stage === 'sent') toast.loading(body, options);
    else if (stage === 'confirmed') toast.success(body, options);
    else if (stage === 'failed') toast.error(body, options);
    else toast.info(body, options);
}

/** Waits for a sent transaction to confirm with its pop-up showing; throws, like waitForConfirmation, if it doesn't */
export async function followTx(txid: string, words: TxWords): Promise<void> {
    txToast(txid, 'sent', words);
    try {
        await waitForConfirmation(txid);
    } catch (err) {
        txToast(txid, err instanceof NotConfirmedYet ? 'waiting' : 'failed', words);
        throw err;
    }
    txToast(txid, 'confirmed', words);
}

/** Moving a token from the wallet onto Blaze */
export const moveToBlazeWords = (symbol: string): TxWords => ({
    sent: [`Moving ${symbol} to Blaze`, 'Waiting for its block…'],
    confirmed: [`${symbol} is on Blaze`, 'It settled on the chain.'],
    failed: ["Move to Blaze didn't go through", 'It failed on the chain, so nothing moved.'],
    waiting: ['Still waiting for a block', 'Your move is sent and will land on its own.'],
});
