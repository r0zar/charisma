import { TokenCacheData } from "@/lib/contract-registry-adapter";
import React from "react";
import { Flame } from "lucide-react";
import { getIpfsUrl } from "@/lib/utils";
import { knownBlazeVersion, type BlazeVersion } from "blaze-sdk";

interface TokenLogoProps {
    token: TokenCacheData;
    size?: "sm" | "md" | "lg";
    className?: string;
    suppressFlame?: boolean;
    /** Which Blaze the flame stands for, when the token object can't say (a combined v1 + v2 balance shows as v2) */
    blazeVersion?: BlazeVersion;
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

// Subcomponent for the flame overlay: teal for a Blaze v1 subnet, red for Blaze v2
function TokenFlameOverlay({ size, version }: { size: 'sm' | 'md' | 'lg'; version: BlazeVersion }) {
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
        <div className={`absolute -top-1 -right-1 ${version === 2 ? 'bg-blaze-v2-fill' : 'bg-blaze-fill'} rounded-full ring-2 ring-bg ${flameContainerClasses[size]}`}>
            <Flame className={`text-on-fill fill-current ${flameSizeClasses[size]}`} />
        </div>
    );
}

export default function TokenLogo({ token, size = "md", className = "", suppressFlame = false, blazeVersion }: TokenLogoProps) {
    // Safety check for undefined token
    if (!token) {
        return <div className="w-8 h-8 rounded-full bg-surface-hover " />;
    }

    const isSubnetToken = token.type === 'SUBNET';
    const [imgError, setImgError] = React.useState(false);

    // Size classes for outer and inner containers
    const sizeClasses = {
        sm: "w-5 h-5",
        md: "w-8 h-8",
        lg: "w-10 h-10",
    };
    const initialSize = {
        sm: "text-[10px]",
        md: "text-sm",
        lg: "text-base",
    };

    return (
        <div className={`relative ${sizeClasses[size]} ${className}`} style={{ overflow: 'visible' }}>
            <div className={`w-full h-full rounded-full bg-dark-300 flex items-center justify-center overflow-hidden`}>
                {/* A token without a logo (or a broken one) gets its initial, never another token's logo */}
                {token.image && !imgError ? (
                    <img
                        src={getIpfsUrl(token.image)}
                        alt={token.symbol}
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-surface-hover text-ink-muted font-semibold uppercase select-none ${initialSize[size]}`}>
                        {token.symbol?.charAt(0) || '?'}
                    </div>
                )}
                {/* Optional highlight ring for better visibility */}
                <div className={`absolute inset-0 rounded-full shadow-highlight pointer-events-none`} />
            </div>
            {/* Flame icon overlay for subnet tokens */}
            {isSubnetToken && !suppressFlame && <TokenFlameOverlay size={size} version={blazeVersion ?? knownBlazeVersion(token.contractId) ?? 1} />}
        </div>
    );
} 