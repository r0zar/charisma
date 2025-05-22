import { TrendingUp, ExternalLink, Clock, DollarSign, Package } from "lucide-react";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { TokenCacheData } from "@repo/tokens";

const TokenInfoCard = ({ token, reserves, price }: { token: TokenCacheData; reserves: number; price: number | undefined }) => {
    const tokenDecimals = token.decimals ?? 6;
    const reserveAmount = reserves / (10 ** tokenDecimals);
    const tvl = price !== undefined ? reserveAmount * price : null;

    const reserveAmountDisplay = reserveAmount.toLocaleString(undefined, {
        maximumFractionDigits: 6,
        minimumFractionDigits: 0
    });

    const tvlDisplay = tvl !== null ? `$${tvl.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}` : 'N/A';

    const priceDisplay = price !== undefined ? `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: price < 1 ? 10 : 2
    })}` : 'N/A';

    let totalSupplyDisplay = 'N/A';
    if (token.total_supply !== undefined && token.total_supply !== null) {
        try {
            const supplyNumber = BigInt(token.total_supply);
            const divisor = BigInt(10 ** tokenDecimals);
            totalSupplyDisplay = (Number(supplyNumber * 100n / divisor) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
        } catch (e) {
            console.error("Error formatting total supply:", e);
            totalSupplyDisplay = 'Error';
        }
    }

    const contractId = token.contractId || '';

    const truncateAddress = (address: string) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    return (
        <Card className="overflow-hidden border border-border/50 bg-card h-fit">
            <div className="flex items-stretch">
                <div className="bg-muted/30 p-4 flex items-center justify-center border-r border-border/50">
                    <div className="relative w-16 h-16">
                        <Image
                            src={token.image || '/placeholder.png'}
                            alt={token.symbol || 'Token'}
                            fill
                            className="rounded-full p-0.5"
                            onError={(e) => { e.currentTarget.src = '/placeholder.png'; }}
                        />
                    </div>
                </div>

                <div className="flex-grow p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-semibold text-lg leading-tight">{token.name || 'Unknown Token'}</h3>
                            <div className="text-sm text-muted-foreground flex items-center mt-0.5">
                                <span className="mr-2 font-mono bg-muted/50 px-1.5 py-0.5 rounded text-xs">{token.symbol || '--'}</span>
                                <a
                                    href={`https://explorer.hiro.so/txid/${contractId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs text-primary hover:underline"
                                >
                                    {truncateAddress(contractId)}
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-bold text-lg text-primary">
                                {reserveAmountDisplay}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Pool Balance
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                                <span>Price per Unit:</span>
                            </div>
                            <div className="font-medium">{priceDisplay}</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                                <span>TVL in Pool:</span>
                            </div>
                            <div className="font-medium">{tvlDisplay}</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <Package className="w-3.5 h-3.5 mr-1.5" />
                                <span>Total Supply:</span>
                            </div>
                            <div className="font-medium">{totalSupplyDisplay}</div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default TokenInfoCard;