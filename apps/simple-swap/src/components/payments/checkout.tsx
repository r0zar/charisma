import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import StripePaymentForm from "./stripe";

interface PurchaseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    amountUsd: number;
    tokenAmount: number;
    tokenSymbol: string;
    userAddress: string;
    tokenContract: string;
    tokenDecimals: number;
}

export function PurchaseDialog({
    open,
    onOpenChange,
    amountUsd,
    tokenAmount,
    tokenSymbol,
    userAddress,
    tokenContract,
    tokenDecimals,
}: PurchaseDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-5xl p-0 overflow-hidden border border-border bg-card">
                <DialogTitle>


                    <div className="flex flex-col lg:flex-row h-full">
                        {/* Left: Summary */}
                        <div className="lg:w-1/2 w-full p-6 border-r border-border bg-muted/10">
                            <h2 className="text-lg font-semibold mb-4">Purchase Summary</h2>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground">Buying</div>
                                    <div className="font-semibold text-xl">
                                        {tokenAmount / 10 ** tokenDecimals} {tokenSymbol}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Total</div>
                                    <div className="text-xl font-semibold">${amountUsd.toFixed(2)} USD</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Wallet</div>
                                    <div className="font-mono text-xs break-all">{userAddress}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Contract</div>
                                    <div className="font-mono text-xs break-all">{tokenContract}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Network</div>
                                    <div className="text-sm">Stacks Mainnet</div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Stripe Payment */}
                        <div className="lg:w-1/2 w-full p-6">
                            <h2 className="text-lg font-semibold mb-4">Payment</h2>
                            <StripePaymentForm tokenAmount={tokenAmount} tokenType={tokenContract} amount={amountUsd * 100} />
                        </div>
                    </div>
                </DialogTitle>
            </DialogContent>
        </Dialog>
    );
}
