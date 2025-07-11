import React from 'react';
import { Button } from '../ui/button';
import { ChevronDown } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import TokenLogo from '../TokenLogo';
import { TokenCacheData } from '@repo/tokens';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

interface TokenSelectorButtonProps {
    selectionType: 'from' | 'to' | 'tradingPairBase' | 'tradingPairQuote';
    placeholder?: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
}

export default function TokenSelectorButton({
    selectionType,
    placeholder = 'Select Token',
    className = '',
    size = 'md',
    disabled = false
}: TokenSelectorButtonProps) {
    const {
        openTokenSelection,
        tradingPairBase,
        tradingPairQuote
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken
    } = useSwapTokens();

    // Get the current token based on selection type
    const getCurrentToken = (): TokenCacheData | null => {
        switch (selectionType) {
            case 'from':
                return selectedFromToken;
            case 'to':
                return selectedToToken;
            case 'tradingPairBase':
                return tradingPairBase;
            case 'tradingPairQuote':
                return tradingPairQuote;
            default:
                return null;
        }
    };

    // Get the dialog title based on selection type
    const getDialogTitle = (): string => {
        switch (selectionType) {
            case 'from':
                return 'Select Input Token';
            case 'to':
                return 'Select Output Token';
            case 'tradingPairBase':
                return 'Select Base Token';
            case 'tradingPairQuote':
                return 'Select Quote Token';
            default:
                return 'Select Token';
        }
    };

    const currentToken = getCurrentToken();

    const handleClick = () => {
        if (!disabled) {
            openTokenSelection(selectionType, getDialogTitle());
        }
    };

    // Size variants
    const sizeClasses = {
        sm: 'h-8 px-2 text-sm',
        md: 'h-10 px-3',
        lg: 'h-12 px-4 text-lg'
    };

    const logoSize = size === 'sm' ? 'sm' : size === 'lg' ? 'md' : 'sm';

    return (
        <Button
            variant="outline"
            onClick={handleClick}
            disabled={disabled}
            className={`justify-between ${sizeClasses[size]} ${className}`}
        >
            <div className="flex items-center space-x-2">
                {currentToken ? (
                    <>
                        <TokenLogo
                            token={{ ...currentToken, image: currentToken.image ?? undefined }}
                            size={logoSize}
                        />
                        <span className="font-medium">{currentToken.symbol}</span>
                    </>
                ) : (
                    <span className="text-gray-500">{placeholder}</span>
                )}
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
        </Button>
    );
} 