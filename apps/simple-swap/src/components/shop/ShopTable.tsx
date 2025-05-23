import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShopItem } from '@/types/shop';
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
    Plus
} from 'lucide-react';
import { SHOP_CATEGORIES } from '@/lib/shop/constants';
import { useWallet } from '@/contexts/wallet-context';
import {
    getTypeConfig,
    formatPrice,
    formatCreator,
    formatTokenAmount as utilFormatTokenAmount
} from '@/utils/shop-table-utils';
import { useShopTable } from '@/hooks/useShopTable';
import OfferTooltip from './OfferTooltip';
import BidDialog from './BidDialog';
import PurchaseDialog from './PurchaseDialog';
import { useRouter } from 'next/navigation';

interface ShopTableProps {
    items: ShopItem[];
    subnetTokens: TokenDef[];
}

type SortField = 'name' | 'type' | 'price' | 'bids' | 'created' | 'creator';

// Memoized table row component to prevent unnecessary re-renders
const TableRowComponent = React.memo(({
    item,
    typeConfig,
    TypeIcon,
    bnsNames,
    subnetTokens,
    prices,
    onItemClick,
    onViewDetailsClick
}: {
    item: ShopItem;
    typeConfig: any;
    TypeIcon: any;
    bnsNames: Record<string, string | null>;
    subnetTokens: TokenDef[];
    prices: Record<string, any>;
    onItemClick: (item: ShopItem) => void;
    onViewDetailsClick: (item: ShopItem, e: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
    const handleRowClick = useCallback(() => onItemClick(item), [item, onItemClick]);
    const handleDetailsClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => onViewDetailsClick(item, e), [item, onViewDetailsClick]);
    const handleActionClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onItemClick(item);
    }, [item, onItemClick]);

    const tableRow = (
        <TableRow
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={handleRowClick}
        >
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

            {/* Name */}
            <TableCell>
                <div className="space-y-1">
                    <p className="font-medium line-clamp-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                        {item.description}
                    </p>
                </div>
            </TableCell>

            {/* Creator */}
            <TableCell className="hidden md:table-cell">
                {item.type === SHOP_CATEGORIES.OFFER && item.metadata?.offerCreatorAddress ? (
                    <div className="text-xs">
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span
                                className={
                                    bnsNames[item.metadata.offerCreatorAddress]
                                        ? "font-medium text-primary"
                                        : "font-mono text-muted-foreground"
                                }
                                title={item.metadata.offerCreatorAddress}
                            >
                                {bnsNames[item.metadata.offerCreatorAddress] === undefined
                                    ? "Loading..."
                                    : formatCreator(item.metadata.offerCreatorAddress, bnsNames)
                                }
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

            {/* Bids */}
            <TableCell className="hidden md:table-cell">
                <div className="text-sm">
                    {item.type === SHOP_CATEGORIES.OFFER ? (
                        <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {item.metadata?.bids?.length || 0}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">-</span>
                    )}
                </div>
            </TableCell>

            {/* Time */}
            <TableCell className="hidden lg:table-cell">
                <div className="text-xs text-muted-foreground">
                    {item.metadata?.createdAt ? (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(item.metadata.createdAt).toLocaleDateString()}
                        </span>
                    ) : (
                        'N/A'
                    )}
                </div>
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
                        ) : (
                            <>
                                <ShoppingCart className="h-3 w-3 mr-1" />
                                Buy
                            </>
                        )}
                    </Button>

                    {/* View Details button for offers */}
                    {item.type === SHOP_CATEGORIES.OFFER && (
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
        </TableRow>
    );

    // Wrap offers with tooltip
    if (item.type === SHOP_CATEGORIES.OFFER && item.metadata?.offerAssets) {
        return (
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    {tableRow}
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="start"
                    sideOffset={10}
                    className="p-0 max-w-none z-50"
                >
                    <OfferTooltip
                        item={item}
                        subnetTokens={subnetTokens}
                        prices={prices}
                    />
                </TooltipContent>
            </Tooltip>
        );
    }

    return tableRow;
});

TableRowComponent.displayName = 'TableRowComponent';

const ShopTable: React.FC<ShopTableProps> = ({ items, subnetTokens }) => {
    const { prices } = useWallet();
    const router = useRouter();

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

        // Handlers
        handleSort,
        handleItemClick,
        handleViewDetails,
        handlePurchase,
        handleSubmitBid,
        closeDialog
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
        handleViewDetails(item);
    }, [handleViewDetails]);

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
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search items..."
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
                                        Bids
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
                                <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedItems.map((item, index) => {
                                const typeConfig = getTypeConfig(item.type);
                                const TypeIcon = typeConfig.icon;

                                return (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            delay: index * 0.05,
                                            duration: 0.3,
                                            ease: "easeOut"
                                        }}
                                        style={{ display: 'contents' }}
                                    >
                                        <TableRowComponent
                                            item={item}
                                            typeConfig={typeConfig}
                                            TypeIcon={TypeIcon}
                                            bnsNames={bnsNames}
                                            subnetTokens={subnetTokens}
                                            prices={prices || {}}
                                            onItemClick={handleItemClick}
                                            onViewDetailsClick={handleViewDetailsClick}
                                        />
                                    </motion.div>
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
                />
            </div>
        </TooltipProvider>
    );
};

export default React.memo(ShopTable); 