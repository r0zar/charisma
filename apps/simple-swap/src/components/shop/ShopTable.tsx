import React, { useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShopItem, isOfferItem, isPerpFundingRequest } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { CursorFollowingTooltip } from '@/components/ui/cursor-following-tooltip';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Image from 'next/image';
import {
    ArrowUpDown,
    Search,
    Filter,
    TrendingUp,
    Clock,
    ShoppingCart,
    Gavel,
    Eye,
    User,
    Plus,
    CheckCircle,
    XCircle,
    Wallet,
    AlertTriangle,
    Info,
    ExternalLink
} from 'lucide-react';
import { SHOP_CATEGORIES } from '@/lib/shop/constants';
import { useWallet } from '@/contexts/wallet-context';
import {
    getTypeConfig,
    formatPrice,
    formatTokenAmount as utilFormatTokenAmount
} from '@/utils/shop-table-utils';
import { useShopTable } from '@/hooks/useShopTable';
import OfferTooltip from './OfferTooltip';
import BidDialog from './BidDialog';
import PurchaseDialog from './PurchaseDialog';
import FundingRequestDialog from './FundingRequestDialog';
import { useRouter } from 'next/navigation';
import { getTokenBalance } from '@/app/actions';
import { request } from '@stacks/connect';
import { uintCV, noneCV, PostCondition, Pc } from '@stacks/transactions';
import { getTokenMetadataCached } from '@repo/tokens';
import { toast } from 'sonner';

interface ShopTableProps {
    items: ShopItem[];
    subnetTokens: TokenDef[];
}

type SortField = 'name' | 'type' | 'price' | 'bids' | 'created' | 'creator' | 'balance';

// Balance status for offer creators
interface BalanceStatus {
    loading: boolean;
    allSufficient: boolean;
    insufficientTokens: string[];
    error?: string;
}

// Memoized table row component to prevent unnecessary re-renders
const TableRowComponent = React.memo(({
    item,
    typeConfig,
    TypeIcon,
    bnsNames,
    subnetTokens,
    prices,
    balanceStatuses,
    onItemClick,
    onViewDetailsClick
}: {
    item: ShopItem;
    typeConfig: any;
    TypeIcon: any;
    bnsNames: Record<string, string | null>;
    subnetTokens: TokenDef[];
    prices: Record<string, any>;
    balanceStatuses: Record<string, BalanceStatus>;
    onItemClick: (item: ShopItem) => void;
    onViewDetailsClick: (item: ShopItem, e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
    const handleRowClick = useCallback(() => onItemClick(item), [item, onItemClick]);
    const handleDetailsClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => onViewDetailsClick(item, e), [item, onViewDetailsClick]);
    const handleActionClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onItemClick(item);
    }, [item, onItemClick]);

    const tableRowContent = (
        <>
            {/* Image */}
            <TableCell>
                <div className="relative h-10 w-10 rounded-md overflow-hidden bg-muted">
                    {item.image ? (
                        <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center">
                            <TypeIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                    )}
                </div>
            </TableCell>

            {/* Name - with tooltip for offers */}
            <TableCell>
                {isOfferItem(item) && item.offerAssets ? (
                    <CursorFollowingTooltip
                        delayDuration={200}
                        className="p-0 max-w-none z-50 border-border/50"
                        content={
                            <OfferTooltip
                                item={item}
                                subnetTokens={subnetTokens}
                                prices={prices}
                            />
                        }
                    >
                        <div className="space-y-1">
                            <p className="font-medium line-clamp-1">{item.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                                {item.description}
                            </p>
                        </div>
                    </CursorFollowingTooltip>
                ) : (
                    <div className="space-y-1">
                        <p className="font-medium line-clamp-1">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.description}
                        </p>
                    </div>
                )}
            </TableCell>

            {/* Creator */}
            <TableCell className="hidden md:table-cell">
                {isOfferItem(item) && item.offerCreatorAddress ? (
                    <div className="text-xs">
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span
                                className={
                                    bnsNames[item.offerCreatorAddress]
                                        ? "font-medium text-primary"
                                        : "font-mono text-muted-foreground"
                                }
                                title={item.offerCreatorAddress}
                            >
                                {bnsNames[item.offerCreatorAddress] === undefined
                                    ? "Loading..."
                                    : bnsNames[item.offerCreatorAddress] || `${item.offerCreatorAddress.slice(0, 6)}...${item.offerCreatorAddress.slice(-4)}`
                                }
                            </span>
                        </div>
                    </div>
                ) : isPerpFundingRequest(item) ? (
                    <div className="text-xs">
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span
                                className="font-mono text-muted-foreground"
                                title={item.traderId}
                            >
                                {`${item.traderId.slice(0, 6)}...${item.traderId.slice(-4)}`}
                            </span>
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                )}
            </TableCell>

            {/* Type */}
            <TableCell>
                <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {typeConfig.label}
                </Badge>
            </TableCell>

            {/* Price */}
            <TableCell>
                <div className="font-medium text-sm">
                    {formatPrice(item, subnetTokens, utilFormatTokenAmount)}
                </div>
            </TableCell>

            {/* Bids/Offers */}
            <TableCell className="hidden md:table-cell">
                <div className="text-sm">
                    {isOfferItem(item) ? (
                        <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {item.bids?.length || 0}
                        </span>
                    ) : isPerpFundingRequest(item) ? (
                        <span className="flex items-center gap-1">
                            <Wallet className="h-3 w-3" />
                            {item.fundingOffers?.length || 0}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">-</span>
                    )}
                </div>
            </TableCell>

            {/* Time */}
            <TableCell className="hidden lg:table-cell">
                <div className="text-xs text-muted-foreground">
                    {item.createdAt ? (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                    ) : (
                        'N/A'
                    )}
                </div>
            </TableCell>

            {/* Balance Status (for offers only) */}
            <TableCell className="hidden lg:table-cell">
                {isOfferItem(item) ? (
                    <div className="flex items-center gap-1">
                        {(() => {
                            const balanceStatus = balanceStatuses[item.id];
                            if (!balanceStatus) return null;

                            if (balanceStatus.loading) {
                                return (
                                    <Tooltip delayDuration={300}>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                                                <div className="animate-pulse h-3 w-3 bg-muted-foreground/30 rounded-full"></div>
                                                <span className="text-xs">Checking...</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Verifying offer creator has sufficient token balances</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            if (balanceStatus.error) {
                                return (
                                    <Tooltip delayDuration={300}>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-muted-foreground cursor-help">
                                                <AlertTriangle className="h-3 w-3" />
                                                <span className="text-xs">Error</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Failed to verify balances: {balanceStatus.error}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            if (balanceStatus.allSufficient) {
                                return (
                                    <Tooltip delayDuration={300}>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 cursor-help">
                                                <CheckCircle className="h-3 w-3" />
                                                <span className="text-xs">Verified</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>✅ Offer creator has sufficient balance for all offered tokens</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            } else {
                                return (
                                    <Tooltip delayDuration={300}>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 cursor-help">
                                                <XCircle className="h-3 w-3" />
                                                <span className="text-xs">
                                                    Insufficient ({balanceStatus.insufficientTokens.length})
                                                </span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <div>
                                                <p>⚠️ Insufficient balance for:</p>
                                                <ul className="mt-1 space-y-1">
                                                    {balanceStatus.insufficientTokens.map((token, idx) => (
                                                        <li key={idx} className="text-xs">• {token}</li>
                                                    ))}
                                                </ul>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    This offer may not be executable
                                                </p>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }
                        })()}
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                )}
            </TableCell>

            {/* Actions */}
            <TableCell>
                <div className="flex items-center gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={handleActionClick}
                    >
                        {item.type === SHOP_CATEGORIES.OFFER ? (
                            <>
                                <Gavel className="h-3 w-3 mr-1" />
                                Bid
                            </>
                        ) : item.type === 'perp_funding' ? (
                            <>
                                <Wallet className="h-3 w-3 mr-1" />
                                Fund
                            </>
                        ) : (
                            <>
                                <ShoppingCart className="h-3 w-3 mr-1" />
                                Buy
                            </>
                        )}
                    </Button>

                    {/* View Details button for offers and funding requests */}
                    {(item.type === SHOP_CATEGORIES.OFFER || item.type === 'perp_funding') && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs p-1"
                            onClick={handleDetailsClick}
                            title="View details"
                        >
                            <Eye className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </TableCell>
        </>
    );

    return (
        <TableRow
            className={`border-0 cursor-pointer transition-colors duration-200 hover:bg-muted/30 ${isOfferItem(item) && item.offerAssets ? 'hover:shadow-sm' : ''}`}
            onClick={handleRowClick}
        >
            {tableRowContent}
        </TableRow>
    );
});

TableRowComponent.displayName = 'TableRowComponent';

const ShopTable: React.FC<ShopTableProps> = ({ items, subnetTokens }) => {
    const { prices, address } = useWallet();
    const router = useRouter();

    // Balance status tracking for offer creators
    const [balanceStatuses, setBalanceStatuses] = useState<Record<string, BalanceStatus>>({});

    // Deposit transaction state
    const [isDepositing, setIsDepositing] = useState(false);

    // Funding request dialog state
    const [fundingDialogOpen, setFundingDialogOpen] = useState(false);
    const [fundingDialogMode, setFundingDialogMode] = useState<'view' | 'fund' | 'accept'>('view');
    const [selectedFundingRequest, setSelectedFundingRequest] = useState<ShopItem | null>(null);
    const [isFundingSubmitting, setIsFundingSubmitting] = useState(false);

    // Function to handle deposit transaction
    const handleDepositTransaction = async (
        tokenSymbol: string,
        amount: number
    ): Promise<{ success: boolean; txId?: string; error?: string }> => {
        if (!address) {
            return { success: false, error: 'Wallet not connected' };
        }

        try {
            // Find the subnet token
            const subnetToken = subnetTokens.find(t => t.symbol === tokenSymbol);
            if (!subnetToken) {
                return { success: false, error: `Token ${tokenSymbol} not found in subnet tokens` };
            }

            // The subnet contract is the same as the token contract
            const subnetContractId = subnetToken.id;

            // Get the subnet token metadata to find the base token
            const subnetMetadata = await getTokenMetadataCached(subnetContractId);
            if (!subnetMetadata?.base) {
                return { success: false, error: `No base token found for subnet ${tokenSymbol}` };
            }

            // Get the base token metadata (this is what the user will be sending)
            const baseTokenMetadata = await getTokenMetadataCached(subnetMetadata.base);
            if (!baseTokenMetadata) {
                return { success: false, error: `Base token metadata not found for ${tokenSymbol}` };
            }

            // Convert amount to atomic units
            const decimals = baseTokenMetadata.decimals || 6;
            const atomicAmount = Math.floor(amount * Math.pow(10, decimals));

            // Parse subnet contract address and name
            const [contractAddress, contractName] = subnetContractId.split('.');
            if (!contractAddress || !contractName) {
                return { success: false, error: 'Invalid subnet contract format' };
            }

            // Set up post conditions - user sends base tokens
            const postConditions: PostCondition[] = [
                Pc.principal(address)
                    .willSendEq(atomicAmount)
                    .ft(baseTokenMetadata.contractId as `${string}.${string}`, baseTokenMetadata.identifier!)
            ];

            // Set up contract call parameters
            const params = {
                contract: subnetContractId as `${string}.${string}`,
                functionName: 'deposit',
                functionArgs: [
                    uintCV(atomicAmount),
                    noneCV() // recipient defaults to tx-sender
                ],
                postConditions,
            };

            // Execute the transaction
            const result = await request('stx_callContract', params);

            if (result && result.txid) {
                return { success: true, txId: result.txid };
            } else {
                return { success: false, error: 'Transaction failed or was rejected' };
            }
        } catch (error) {
            console.error('Deposit transaction error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            return { success: false, error: errorMessage };
        }
    };

    // Check balance for a specific offer
    const checkOfferBalance = async (offerItem: ShopItem) => {
        if (!isOfferItem(offerItem)) return;

        setBalanceStatuses(prev => ({
            ...prev,
            [offerItem.id]: { loading: true, allSufficient: false, insufficientTokens: [] }
        }));

        try {
            const insufficientTokens: string[] = [];

            // Check balance for each offered token
            for (const asset of offerItem.offerAssets) {
                const balance = await getTokenBalance(asset.token, offerItem.offerCreatorAddress);
                const requiredAmount = parseInt(asset.amount);

                if (balance < requiredAmount) {
                    const tokenSymbol = asset.tokenData?.symbol || asset.token.split('.')[1] || 'Unknown';
                    insufficientTokens.push(tokenSymbol);
                }
            }

            setBalanceStatuses(prev => ({
                ...prev,
                [offerItem.id]: {
                    loading: false,
                    allSufficient: insufficientTokens.length === 0,
                    insufficientTokens
                }
            }));
        } catch (error) {
            console.error('Error checking offer balance:', error);
            setBalanceStatuses(prev => ({
                ...prev,
                [offerItem.id]: {
                    loading: false,
                    allSufficient: false,
                    insufficientTokens: [],
                    error: 'Failed to check balance'
                }
            }));
        }
    };

    // Check balances for all offers when component mounts or items change
    useEffect(() => {
        const offers = items.filter(isOfferItem);
        offers.forEach(offer => {
            if (!balanceStatuses[offer.id]) {
                checkOfferBalance(offer);
            }
        });
    }, [items]);

    const {
        // State
        searchTerm,
        setSearchTerm,
        categoryFilter,
        setCategoryFilter,
        sortField,
        sortDirection,
        selectedItem,
        dialogMode,
        bidAmount,
        setBidAmount,
        bidToken,
        setBidToken,
        bidMessage,
        setBidMessage,
        bnsNames,
        filteredAndSortedItems,
        showDepositPrompt,
        depositPromptData,

        // Handlers
        handleSort,
        handleItemClick,
        handleViewDetails,
        handlePurchase,
        handleSubmitBid,
        closeDialog,
        isSigning,
        isSubmitting,
        handleBidSuccess,
        closeDepositPrompt
    } = useShopTable(items, subnetTokens);

    // Get sort icon
    const getSortIcon = useCallback((field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="h-4 w-4 mx-1 text-muted-foreground" />;
        }
        return (
            <ArrowUpDown
                className={`h-4 w-4 mx-1 ${sortDirection === 'asc' ? 'rotate-180' : ''} text-primary`}
            />
        );
    }, [sortField, sortDirection]);

    // Handle view details (for offers)
    const handleViewDetailsClick = useCallback((item: ShopItem, e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (isPerpFundingRequest(item)) {
            setSelectedFundingRequest(item);
            setFundingDialogMode('view');
            setFundingDialogOpen(true);
        } else {
            handleViewDetails(item);
        }
    }, [handleViewDetails]);

    // Handle funding request actions
    const handleFundingRequestClick = useCallback((item: ShopItem) => {
        if (!isPerpFundingRequest(item)) return;

        setSelectedFundingRequest(item);
        // Determine mode based on user role
        if (address === item.traderId) {
            setFundingDialogMode('accept');
        } else {
            setFundingDialogMode('fund');
        }
        setFundingDialogOpen(true);
    }, [address]);

    // Handle creating funding offer
    const handleCreateFundingOffer = useCallback(async (requestId: string, offer: any) => {
        setIsFundingSubmitting(true);
        try {
            const response = await fetch('/api/v1/perps/funding-offer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fundingRequestId: requestId,
                    ...offer
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success('Funding offer created successfully!');
                setFundingDialogOpen(false);
                router.refresh();
            } else {
                throw new Error(result.error || 'Failed to create funding offer');
            }
        } catch (error: any) {
            console.error('Error creating funding offer:', error);
            toast.error(error.message || 'Failed to create funding offer');
        } finally {
            setIsFundingSubmitting(false);
        }
    }, [router]);

    // Handle accepting funding offer
    const handleAcceptFundingOffer = useCallback(async (requestId: string, offerId: string) => {
        setIsFundingSubmitting(true);
        try {
            const response = await fetch('/api/v1/perps/accept-funding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fundingRequestId: requestId,
                    fundingOfferId: offerId
                })
            });

            const result = await response.json();
            if (result.success) {
                toast.success('Funding offer accepted successfully!');
                setFundingDialogOpen(false);
                router.refresh();
            } else {
                throw new Error(result.error || 'Failed to accept funding offer');
            }
        } catch (error: any) {
            console.error('Error accepting funding offer:', error);
            toast.error(error.message || 'Failed to accept funding offer');
        } finally {
            setIsFundingSubmitting(false);
        }
    }, [router]);

    // Close funding dialog
    const closeFundingDialog = useCallback(() => {
        setFundingDialogOpen(false);
        setSelectedFundingRequest(null);
    }, []);

    return (
        <TooltipProvider>
            <div className="space-y-4">
                {/* Controls Bar */}
                <motion.div
                    className="flex flex-col sm:flex-row gap-4 p-4 bg-card border border-border rounded-lg"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    {/* Search and Create Button */}
                    <div className="flex gap-2 flex-1">
                        <div className="relative flex-1 mr-2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search items, creator names, or addresses..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => router.push('/shop/new')}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Offer
                        </Button>
                    </div>

                    {/* Category Filter */}
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full sm:w-48">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            <SelectItem value={SHOP_CATEGORIES.OFFER}>Offers</SelectItem>
                            <SelectItem value={SHOP_CATEGORIES.TOKEN}>Tokens</SelectItem>
                            <SelectItem value={SHOP_CATEGORIES.NFT}>NFTs</SelectItem>
                            <SelectItem value={SHOP_CATEGORIES.PERP_FUNDING}>P2P Perps</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Results Count */}
                    <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap">
                        {filteredAndSortedItems.length} of {items.length} items
                    </div>
                </motion.div>

                {/* Table */}
                <motion.div
                    className="border border-border rounded-lg overflow-hidden"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
                >
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead className="w-12"></TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold hover:bg-transparent"
                                        onClick={() => handleSort('name')}
                                    >
                                        Item Name
                                        {getSortIcon('name')}
                                    </Button>
                                </TableHead>
                                <TableHead className="hidden md:table-cell">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold hover:bg-transparent"
                                        onClick={() => handleSort('creator')}
                                    >
                                        Creator
                                        {getSortIcon('creator')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold hover:bg-transparent"
                                        onClick={() => handleSort('type')}
                                    >
                                        Type
                                        {getSortIcon('type')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold hover:bg-transparent"
                                        onClick={() => handleSort('price')}
                                    >
                                        Price/Bid
                                        {getSortIcon('price')}
                                    </Button>
                                </TableHead>
                                <TableHead className="hidden md:table-cell">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold hover:bg-transparent"
                                        onClick={() => handleSort('bids')}
                                    >
                                        Bids/Offers
                                        {getSortIcon('bids')}
                                    </Button>
                                </TableHead>
                                <TableHead className="hidden lg:table-cell">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold hover:bg-transparent"
                                        onClick={() => handleSort('created')}
                                    >
                                        Time
                                        {getSortIcon('created')}
                                    </Button>
                                </TableHead>
                                <TableHead className="hidden lg:table-cell">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 font-semibold hover:bg-transparent"
                                        onClick={() => handleSort('balance')}
                                    >
                                        Balance
                                        {getSortIcon('balance')}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedItems.map((item, index) => {
                                const typeConfig = getTypeConfig(item.type);
                                const TypeIcon = typeConfig.icon;

                                return (
                                    <TableRowComponent
                                        key={item.id}
                                        item={item}
                                        typeConfig={typeConfig}
                                        TypeIcon={TypeIcon}
                                        bnsNames={bnsNames}
                                        subnetTokens={subnetTokens}
                                        prices={prices || {}}
                                        balanceStatuses={balanceStatuses}
                                        onItemClick={isPerpFundingRequest(item) ? handleFundingRequestClick : handleItemClick}
                                        onViewDetailsClick={handleViewDetailsClick}
                                    />
                                );
                            })}
                        </TableBody>
                    </Table>

                    {/* Empty state */}
                    {filteredAndSortedItems.length === 0 && (
                        <div className="text-center py-12">
                            <div className="text-muted-foreground">
                                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium">No items found</p>
                                <p className="text-sm">Try adjusting your search or filters</p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Purchase Dialog */}
                <PurchaseDialog
                    isOpen={dialogMode === 'purchase'}
                    onClose={closeDialog}
                    selectedItem={selectedItem}
                    subnetTokens={subnetTokens}
                    onPurchase={handlePurchase}
                />

                {/* Bid Dialog */}
                <BidDialog
                    isOpen={dialogMode === 'bid'}
                    onClose={closeDialog}
                    selectedItem={selectedItem}
                    subnetTokens={subnetTokens}
                    bidAmount={bidAmount}
                    setBidAmount={setBidAmount}
                    bidToken={bidToken}
                    setBidToken={setBidToken}
                    bidMessage={bidMessage}
                    setBidMessage={setBidMessage}
                    onSubmitBid={handleSubmitBid}
                    onViewDetails={handleViewDetails}
                    isSigning={isSigning}
                    isSubmitting={isSubmitting}
                    onBidSuccess={handleBidSuccess}
                />

                {/* Deposit Prompt Dialog */}
                <Dialog open={showDepositPrompt} onOpenChange={closeDepositPrompt}>
                    <DialogContent className="sm:max-w-[560px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-primary" />
                                Deposit Tokens to Complete Your Bid
                            </DialogTitle>
                            <DialogDescription>
                                Your bid has been placed successfully, but you'll need to deposit tokens to the subnet for it to be processable.
                            </DialogDescription>
                        </DialogHeader>

                        {depositPromptData && (
                            <div className="space-y-4">
                                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                        <span className="font-medium text-amber-600 dark:text-amber-400">Action Required</span>
                                    </div>
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        You currently have {depositPromptData.currentBalance.toLocaleString()} {depositPromptData.tokenSymbol} but bid {depositPromptData.bidAmount.toLocaleString()} {depositPromptData.tokenSymbol}.
                                        You need to deposit at least {(depositPromptData.bidAmount - depositPromptData.currentBalance).toLocaleString()} more {depositPromptData.tokenSymbol} to the subnet.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-medium">Why deposit to the subnet?</h4>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Enables automatic trade execution when your bid is accepted</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Secures your position in the trading queue</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Prevents failed transactions due to insufficient balance</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span className="font-medium text-blue-600 dark:text-blue-400">How to Deposit</span>
                                    </div>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        You can deposit {depositPromptData.tokenSymbol} tokens to the Charisma subnet through the main dashboard or wallet interface.
                                        The deposit will be reflected in your subnet balance within a few minutes.
                                    </p>
                                </div>
                            </div>
                        )}

                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" onClick={closeDepositPrompt}>
                                I'll Deposit Later
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    closeDepositPrompt();
                                    window.open('https://invest.charisma.rocks/sublinks', '_blank');
                                }}
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Explore Blaze Subnets
                            </Button>
                            {depositPromptData && (
                                <Button
                                    onClick={async () => {
                                        if (!depositPromptData) return;

                                        setIsDepositing(true);
                                        toast.loading("Initiating deposit transaction...");

                                        try {
                                            const amountToDeposit = Math.max(
                                                depositPromptData.bidAmount - depositPromptData.currentBalance,
                                                depositPromptData.bidAmount // Ensure we deposit at least the bid amount
                                            );

                                            const result = await handleDepositTransaction(
                                                depositPromptData.tokenSymbol,
                                                amountToDeposit
                                            );

                                            toast.dismiss();

                                            if (result.success) {
                                                toast.success("Deposit transaction submitted!", {
                                                    description: `TxID: ${result.txId?.substring(0, 10)}...`
                                                });
                                                closeDepositPrompt();
                                            } else {
                                                toast.error("Deposit failed", {
                                                    description: result.error
                                                });
                                            }
                                        } catch (error) {
                                            toast.dismiss();
                                            toast.error("Failed to initiate deposit", {
                                                description: error instanceof Error ? error.message : 'Unknown error'
                                            });
                                        } finally {
                                            setIsDepositing(false);
                                        }
                                    }}
                                    disabled={isDepositing}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    {isDepositing && (
                                        <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    )}
                                    {isDepositing ? 'Depositing...' : 'Deposit Now'}
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Funding Request Dialog */}
                <FundingRequestDialog
                    isOpen={fundingDialogOpen}
                    onClose={closeFundingDialog}
                    fundingRequest={selectedFundingRequest as any}
                    subnetTokens={subnetTokens}
                    mode={fundingDialogMode}
                    onCreateFundingOffer={handleCreateFundingOffer}
                    onAcceptFundingOffer={handleAcceptFundingOffer}
                    isSubmitting={isFundingSubmitting}
                />
            </div>
        </TooltipProvider>
    );
};

export default React.memo(ShopTable); 