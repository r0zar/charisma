import React from 'react';
import { cn } from '@/lib/utils';

interface TokenAvatarProps {
    symbol: string;
    image?: string | null;
    isLp?: boolean;
    className?: string;
}

export const TokenAvatar: React.FC<TokenAvatarProps> = ({
    symbol,
    image,
    isLp = false,
    className
}) => {
    const initials = symbol ? symbol.substring(0, 2).toUpperCase() : 'TK';

    return (
        <div className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
            isLp ? "bg-primary/20" : "bg-muted/80",
            className
        )}>
            {image ? (
                <img
                    src={image}
                    alt={`${symbol} token`}
                    className="h-full w-full object-cover"
                />
            ) : (
                <span className={cn(
                    "text-xs font-bold",
                    isLp ? "text-primary" : "text-foreground"
                )}>
                    {isLp ? "LP" : initials}
                </span>
            )}
        </div>
    );
};

// Component for overlapping multiple token avatars (e.g. for LP tokens)
export const TokenAvatarGroup: React.FC<{
    tokens: Array<{ symbol: string; image?: string | null; }>;
    className?: string;
}> = ({ tokens, className }) => {
    return (
        <div className={cn("flex items-center -space-x-2", className)}>
            {tokens.map((token, index) => (
                <TokenAvatar
                    key={index}
                    symbol={token.symbol}
                    image={token.image}
                    className={cn(
                        "ring-2 ring-background",
                        index > 0 && "ml-[-0.5rem]"
                    )}
                />
            ))}
        </div>
    );
}; 