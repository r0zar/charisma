import { Offer } from "@/lib/otc/schema";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TokenDef } from "@/types/otc";

// Helper to shorten addresses (optional, can be expanded)
const shortenAddress = (address: string, startChars = 6, endChars = 4) => {
    if (!address || address.length < startChars + endChars + 2) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

// Helper to format token amount (similar to ActiveBids)
const formatTokenAmount = (atomicAmount: string, tokenInfo: TokenDef | undefined): string => {
    if (!tokenInfo) return atomicAmount + " (atomic)";
    const amount = parseInt(atomicAmount) / 10 ** tokenInfo.decimals;
    return amount.toLocaleString(undefined, {
        maximumFractionDigits: tokenInfo.decimals,
        minimumFractionDigits: Math.min(tokenInfo.decimals, 2),
    }) + ` ${tokenInfo.symbol}`;
};

interface OfferDetailsProps {
    offer: Offer;
    subnetTokens: TokenDef[];
}

export default function OfferDetails({ offer, subnetTokens }: OfferDetailsProps) {
    const getBadgeVariant = (status: Offer["status"]) => {
        switch (status) {
            case "open":
                return "default";
            case "filled":
                return "default"; // Or "secondary" if you have a specific success-like variant
            case "cancelled":
                return "destructive";
            default:
                return "secondary";
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Offer Details</CardTitle>
                    <Badge variant={getBadgeVariant(offer.status)}>
                        {offer.status.toUpperCase()}
                    </Badge>
                </div>
                <CardDescription className="pt-1">
                    ID: <span className="font-mono text-xs">{offer.intentUuid}</span><br />
                    Creator: <span className="font-mono text-xs">{shortenAddress(offer.offerCreatorAddress)}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="text-sm font-medium mb-1 text-muted-foreground">Assets Offered:</h3>
                    <div className="space-y-2">
                        {offer.offerAssets.map((asset, index) => {
                            const tokenInfo = subnetTokens?.find(t => t.id === asset.token);
                            const formattedAmount = formatTokenAmount(asset.amount, tokenInfo);
                            const tokenName = tokenInfo ? tokenInfo.name : asset.token;

                            return (
                                <div key={index} className="p-3 border rounded-md bg-muted/30 flex items-center space-x-3">
                                    {tokenInfo?.logo && (
                                        <img src={tokenInfo.logo} alt={tokenInfo.name} className="h-8 w-8 rounded-full" />
                                    )}
                                    <div className="flex-grow">
                                        <p className="font-semibold">
                                            {tokenInfo ? `${tokenInfo.name} (${tokenInfo.symbol})` : asset.token}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Amount: {formattedAmount}</p>
                                        {!tokenInfo && <p className="text-xs text-muted-foreground">(Raw token ID: {asset.token})</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}