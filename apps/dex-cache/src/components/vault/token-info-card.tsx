import { TrendingUp, ExternalLink, Clock } from "lucide-react";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { TokenCacheData } from "@repo/tokens";

const TokenInfoCard = ({ token, reserves, price }: { token: TokenCacheData; reserves: number; price: number | undefined }) => {
    const reserveAmount = reserves / (10 ** (token.decimals || 6));
    const value = price !== undefined ? reserveAmount * price : null;

    // Show 'N/A' if price is not available
    const volumeDisplay = value !== null ? `$${(value * 0.15).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'N/A';
    const changeDisplay = value !== null ? '+0%' : 'N/A'; // No real change data, so show 0% or N/A

    // Calculate total supply with decimals applied
    const totalSupply = token.total_supply
        ? (Number(token.total_supply) / (10 ** (token.decimals || 6))).toLocaleString(undefined, { maximumFractionDigits: 2 })
        : 'N/A';

    // Get contract ID for explorer link
    const contractId = token.contractId || token.contract_principal || '';

    // Truncate contract ID for display
    const truncateAddress = (address: string) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    return (
        <Card className="overflow-hidden border border-border/50">
            <div className="flex items-stretch">
                <div className="bg-muted/30 p-4 flex items-center justify-center">
                    <div className="relative w-16 h-16">
                        <Image
                            src={token.image || '/placeholder.png'}
                            alt={token.symbol || 'Token'}
                            fill
                            className="rounded-full p-1"
                            onError={(e) => { e.currentTarget.src = '/placeholder.png'; }}
                        />
                    </div>
                </div>

                <div className="flex-grow p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-semibold text-lg">{token.name || 'Unknown Token'}</h3>
                            <div className="text-sm text-muted-foreground flex items-center">
                                <span className="mr-2">{token.symbol || '--'}</span>
                                <a
                                    href={`https://explorer.hiro.so/txid/${contractId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs text-blue-500 hover:underline"
                                >
                                    {truncateAddress(contractId)}
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-bold text-lg">
                                {reserveAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {value !== null ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Price N/A'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/40">
                        <div className="flex justify-between text-sm">
                            <div className="flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                <span>24h Volume:</span>
                            </div>
                            <div className="font-medium">
                                {volumeDisplay}
                            </div>
                        </div>
                        <div className="flex justify-between text-sm mt-1.5">
                            <div className="flex items-center">
                                <TrendingUp className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                <span>Total Supply:</span>
                            </div>
                            <div className="font-medium text-muted-foreground">
                                {totalSupply}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default TokenInfoCard;