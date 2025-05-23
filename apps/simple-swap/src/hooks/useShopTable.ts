import { useState, useMemo, useEffect, useCallback } from 'react';
import { ShopItem } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { SHOP_CATEGORIES } from '@/lib/shop/constants';
import { useRouter } from 'next/navigation';
import { getPrimaryBnsName } from '@repo/polyglot';

type SortField = 'name' | 'type' | 'price' | 'bids' | 'created' | 'creator';
type SortDirection = 'asc' | 'desc';
type DialogMode = 'purchase' | 'bid' | null;

export const useShopTable = (items: ShopItem[], subnetTokens: TokenDef[]) => {
    const router = useRouter();

    // State management
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<SortField>('created');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
    const [dialogMode, setDialogMode] = useState<DialogMode>(null);

    // Bid form state
    const [bidAmount, setBidAmount] = useState('');
    const [bidToken, setBidToken] = useState('');
    const [bidMessage, setBidMessage] = useState('');

    // BNS names cache
    const [bnsNames, setBnsNames] = useState<Record<string, string | null>>({});

    // Memoize unique offer creators to prevent recalculation
    const offerCreators = useMemo(() => {
        return items
            .filter(item => item.type === SHOP_CATEGORIES.OFFER && item.metadata?.offerCreatorAddress)
            .map(item => item.metadata!.offerCreatorAddress!)
            .filter((address, index, self) => self.indexOf(address) === index); // Remove duplicates
    }, [items]);

    // Load BNS names for offer creators - Fixed infinite loop
    useEffect(() => {
        const loadBnsNames = async () => {
            // Only load for addresses we haven't cached yet
            const addressesToLoad = offerCreators.filter(address => bnsNames[address] === undefined);

            if (addressesToLoad.length === 0) return;

            const bnsPromises = addressesToLoad.map(async (address) => {
                try {
                    const bnsName = await getPrimaryBnsName(address, 'stacks');
                    return { address, bnsName };
                } catch (error) {
                    console.warn(`Failed to fetch BNS for ${address}:`, error);
                    return { address, bnsName: null };
                }
            });

            const results = await Promise.all(bnsPromises);
            const newBnsNames: Record<string, string | null> = {};

            results.forEach((result) => {
                if (result) {
                    newBnsNames[result.address] = result.bnsName;
                }
            });

            // Only update if we have new data
            if (Object.keys(newBnsNames).length > 0) {
                setBnsNames(prev => ({ ...prev, ...newBnsNames }));
            }
        };

        if (offerCreators.length > 0) {
            loadBnsNames();
        }
    }, [offerCreators]); // Removed bnsNames from dependencies to prevent infinite loop

    // Filtering and sorting logic - Added better memoization
    const filteredAndSortedItems = useMemo(() => {
        let filtered = items.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.description.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || item.type === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        filtered.sort((a, b) => {
            let aValue: any, bValue: any;

            switch (sortField) {
                case 'name':
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                case 'type':
                    aValue = a.type;
                    bValue = b.type;
                    break;
                case 'price':
                    aValue = a.price || 0;
                    bValue = b.price || 0;
                    break;
                case 'bids':
                    aValue = a.metadata?.bids?.length || 0;
                    bValue = b.metadata?.bids?.length || 0;
                    break;
                case 'created':
                    aValue = new Date(a.metadata?.createdAt || 0).getTime();
                    bValue = new Date(b.metadata?.createdAt || 0).getTime();
                    break;
                case 'creator':
                    aValue = a.metadata?.offerCreatorAddress || '';
                    bValue = b.metadata?.offerCreatorAddress || '';
                    break;
                default:
                    aValue = a.title;
                    bValue = b.title;
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [items, searchTerm, categoryFilter, sortField, sortDirection]);

    // Memoized handlers to prevent unnecessary re-renders
    const handleSort = useCallback((field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    }, [sortField, sortDirection]);

    const handleItemClick = useCallback((item: ShopItem) => {
        setSelectedItem(item);
        if (item.type === SHOP_CATEGORIES.OFFER) {
            setDialogMode('bid');
            // Reset bid form
            setBidAmount('');
            setBidToken(subnetTokens.length > 0 ? subnetTokens[0].symbol : '');
            setBidMessage('');
        } else {
            setDialogMode('purchase');
        }
    }, [subnetTokens]);

    const handleViewDetails = useCallback((item: ShopItem) => {
        router.push(`/shop/${item.id}`);
    }, [router]);

    const handlePurchase = useCallback(async (item: ShopItem) => {
        console.log('Purchase item:', item);
        setDialogMode(null);
        setSelectedItem(null);
        setBidAmount('');
        setBidToken(subnetTokens.length > 0 ? subnetTokens[0].symbol : '');
        setBidMessage('');
    }, [subnetTokens]);

    const handleSubmitBid = useCallback(async () => {
        if (!selectedItem || !bidAmount) return;

        console.log('Submit bid:', {
            item: selectedItem,
            amount: bidAmount,
            token: bidToken,
            message: bidMessage
        });

        setDialogMode(null);
        setSelectedItem(null);
        setBidAmount('');
        setBidToken(subnetTokens.length > 0 ? subnetTokens[0].symbol : '');
        setBidMessage('');
    }, [selectedItem, bidAmount, bidToken, bidMessage, subnetTokens]);

    const closeDialog = useCallback(() => {
        setDialogMode(null);
        setSelectedItem(null);
        setBidAmount('');
        setBidToken(subnetTokens.length > 0 ? subnetTokens[0].symbol : '');
        setBidMessage('');
    }, [subnetTokens]);

    return {
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
    };
}; 