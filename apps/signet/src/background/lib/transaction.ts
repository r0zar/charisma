import { Cl } from '@stacks/transactions';
import { TransactionType } from './constants';
import type {
    BaseTransaction,
    TransactionRequest,
    Transfer,
    Prediction,
    ClaimReward
} from './types';

/**
 * Represents a single transaction in the queue
 */
export class Transaction implements BaseTransaction {
    type: TransactionType;
    affectedUsers: string[];
    data: TransactionRequest;
    batchFunction: string;

    constructor(data: TransactionRequest) {
        this.data = data;
        this.type = data.type;
        this.batchFunction = `signed-${this.type}`;

        // Set affected users based on transaction type
        if (this.type === TransactionType.TRANSFER) {
            const transfer = data as Transfer;
            this.affectedUsers = [data.signer, transfer.to];
        } else {
            // For other types, only the signer is affected
            this.affectedUsers = [data.signer];
        }
    }

    /**
     * Gets the balance changes this transaction would cause
     * @returns A map of user addresses to their balance changes (positive or negative)
     */
    getBalanceChanges(): Map<string, number> {
        const changes = new Map<string, number>();

        if (this.type === TransactionType.TRANSFER) {
            const transfer = this.data as Transfer;
            changes.set(transfer.signer, -transfer.amount);
            changes.set(transfer.to, transfer.amount);
        } else if (this.type === TransactionType.PREDICT) {
            const prediction = this.data as Prediction;
            changes.set(prediction.signer, -prediction.amount);
        }
        // For claim reward, we don't include it in balance changes
        // since we can't predict the exact amount without contract lookup

        return changes;
    }

    /**
     * Converts the transaction to a Clarity value for on-chain processing
     * @returns Clarity tuple for the transaction
     */
    toClarityValue(): any {
        switch (this.type) {
            case TransactionType.TRANSFER: {
                const transfer = this.data as Transfer;
                return Cl.tuple({
                    signet: Cl.tuple({
                        signature: Cl.bufferFromHex(transfer.signature),
                        nonce: Cl.uint(transfer.nonce)
                    }),
                    to: Cl.principal(transfer.to),
                    amount: Cl.uint(transfer.amount)
                });
            }
            case TransactionType.PREDICT: {
                const prediction = this.data as Prediction;
                return Cl.tuple({
                    signet: Cl.tuple({
                        signature: Cl.bufferFromHex(prediction.signature),
                        nonce: Cl.uint(prediction.nonce)
                    }),
                    market_id: Cl.stringAscii(prediction.marketId),
                    outcome_id: Cl.uint(prediction.outcomeId),
                    amount: Cl.uint(prediction.amount)
                });
            }
            case TransactionType.CLAIM_REWARD: {
                const claim = this.data as ClaimReward;
                return Cl.tuple({
                    signet: Cl.tuple({
                        signature: Cl.bufferFromHex(claim.signature),
                        nonce: Cl.uint(claim.nonce)
                    }),
                    receipt_id: Cl.uint(claim.receiptId)
                });
            }
            default:
                throw new Error(`Cannot convert transaction type ${this.type} to Clarity value`);
        }
    }
}