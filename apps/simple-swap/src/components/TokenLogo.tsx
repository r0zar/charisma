import React from "react";
import type { Token } from "../lib/swap-client";

interface TokenLogoProps {
    token: Token;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export default function TokenLogo({ token, size = "md", className = "" }: TokenLogoProps) {
    const sizeClasses = {
        sm: "w-5 h-5",
        md: "w-8 h-8",
        lg: "w-10 h-10",
    };

    const getTokenLogo = (token: Token) => {
        return token.image || `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/${token.contractId}/logo.png`;
    };

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
        </div>
    );
} 