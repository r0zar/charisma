import { TokenCacheData } from "@repo/tokens";
import React from "react";
import { Flame } from "lucide-react";

interface TokenLogoProps {
    token: TokenCacheData;
    size?: "sm" | "md" | "lg";
    className?: string;
    suppressFlame?: boolean;
}

export default function TokenLogo({ token, size = "md", className = "", suppressFlame = false }: TokenLogoProps) {
    const sizeClasses = {
        sm: "w-5 h-5",
        md: "w-8 h-8",
        lg: "w-10 h-10",
    };

    const flameSizeClasses = {
        sm: "w-2 h-2",
        md: "w-2.5 h-2.5",
        lg: "w-3 h-3",
    };

    const flameContainerClasses = {
        sm: "p-0.5",
        md: "p-0.5",
        lg: "p-1",
    };

    const getTokenLogo = (token: TokenCacheData) => {
        return token.image || `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/${token.contractId}/logo.png`;
    };

    const isSubnetToken = token.type === 'SUBNET';

    return (
        <div className={`relative ${className}`}>
            <div className={`rounded-full overflow-hidden flex items-center justify-center bg-dark-300 ${sizeClasses[size]}`}>
                <img
                    src={getTokenLogo(token)}
                    alt={token.symbol}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // Fallback to token symbol if image fails to load
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).parentElement!.innerHTML = token.symbol.substring(0, 2);
                    }}
                />
            </div>
            {/* Optional highlight ring for better visibility */}
            <div className={`absolute inset-0 rounded-full shadow-highlight ${sizeClasses[size]}`}></div>

            {/* Flame icon overlay for subnet tokens */}
            {isSubnetToken && !suppressFlame && (
                <div className={`absolute -top-1 -right-1 bg-red-600 rounded-full ${flameContainerClasses[size]} shadow-sm`}>
                    <Flame className={`text-white ${flameSizeClasses[size]}`} />
                </div>
            )}
        </div>
    );
} 