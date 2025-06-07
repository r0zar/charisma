import { TokenCacheData } from "@repo/tokens";
import React from "react";
import { Flame } from "lucide-react";

interface TokenLogoProps {
    token: TokenCacheData;
    size?: "sm" | "md" | "lg";
    className?: string;
    suppressFlame?: boolean;
}

// Subcomponent for the logo container
function TokenLogoContainer({ isSubnetToken, size, children }: { isSubnetToken: boolean; size: 'sm' | 'md' | 'lg'; children: React.ReactNode }) {
    const sizeClasses = {
        sm: "w-5 h-5",
        md: "w-8 h-8",
        lg: "w-10 h-10",
    };
    // For lg or subnet, allow overflow for overlays
    const alwaysVisible = size === 'lg' || isSubnetToken;
    return (
        <div
            className={`relative flex items-center justify-center ${sizeClasses[size]}`}
            style={alwaysVisible ? { overflow: 'visible' } : { overflow: 'hidden' }}
        >
            {/* Inner circle for image and highlight */}
            <div className="rounded-full overflow-hidden w-full h-full bg-dark-300 flex items-center justify-center">
                {children}
            </div>
        </div>
    );
}

// Subcomponent for the flame overlay
function TokenFlameOverlay({ size }: { size: 'sm' | 'md' | 'lg' }) {
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
    return (
        <div className={`absolute -top-1 -right-1 bg-red-600 rounded-full ${flameContainerClasses[size]} shadow-sm`}>
            <Flame className={`text-white ${flameSizeClasses[size]}`} />
        </div>
    );
}

export default function TokenLogo({ token, size = "md", className = "", suppressFlame = false }: TokenLogoProps) {
    const getTokenLogo = (token: TokenCacheData) => {
        return token.image || `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/${token.contractId}/logo.png`;
    };

    const isSubnetToken = token.type === 'SUBNET';

    return (
        <div className={`relative ${className}`}>
            <TokenLogoContainer isSubnetToken={isSubnetToken} size={size}>
                <img
                    src={getTokenLogo(token)}
                    alt={token.symbol}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).parentElement!.innerHTML = token.symbol.substring(0, 2);
                    }}
                />
                {/* Optional highlight ring for better visibility */}
                <div className={`absolute inset-0 rounded-full shadow-highlight ${size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10'}`}></div>
            </TokenLogoContainer>
            {/* Flame icon overlay for subnet tokens */}
            {isSubnetToken && !suppressFlame && <TokenFlameOverlay size={size} />}
        </div>
    );
} 