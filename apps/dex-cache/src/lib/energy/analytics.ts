import { getTransactionDetails } from "@repo/polyglot";

import { fetchContractEvents } from "@repo/polyglot";
import { hexToCV } from "@stacks/transactions";

export const fetcHoldToEarnLogs = async (contractAddress: string) => {
    const data = await fetchContractEvents(contractAddress);
    const logs = data.results.map((r: any) => ({ ...(hexToCV(r.contract_log.value.hex) as any).value, tx_id: r.tx_id }));

    const logsFormattedPromises = logs.map(async (log: any) => {
        const { energy, integral, message, op, sender } = log;
        let txDetails = null;
        try {
            txDetails = await getTransactionDetails(log.tx_id as string);
            // console.log('Transaction details:', txDetails); // For debugging if needed
        } catch (error) {
            console.error(`Failed to get transaction details for ${log.tx_id}:`, error);
            // Decide how to handle this - perhaps return log without tx details or mark as failed
        }

        return {
            energy: energy.value as bigint,
            integral: integral.value as bigint,
            message: message.value as string,
            op: op.value as string,
            sender: sender.value as string,
            tx_id: log.tx_id as string,
            block_height: txDetails?.block_height,
            block_time: txDetails?.block_time,
            block_time_iso: txDetails?.block_time_iso,
            tx_status: txDetails?.tx_status,
        };
    });

    const logsFormatted = await Promise.all(logsFormattedPromises);
    return logsFormatted;
}