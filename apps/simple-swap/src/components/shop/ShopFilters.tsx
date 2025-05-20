import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ShopFiltersProps {
    onCategoryChange: (category: string) => void;
    selectedCategory: string;
    priceRange: [number, number];
    onPriceRangeChange: (range: [number, number]) => void;
    onSortChange: (sort: string) => void;
    selectedSort: string;
}

const ShopFilters: React.FC<ShopFiltersProps> = ({
    onCategoryChange,
    selectedCategory,
    priceRange,
    onPriceRangeChange,
    onSortChange,
    selectedSort
}) => {
    // Reset filters to default values
    const handleResetFilters = () => {
        onCategoryChange('all');
        onPriceRangeChange([0, 1000]);
        onSortChange('newest');
    };

    return (
        <Card className="sticky top-24">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle>Filters</CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetFilters}
                        className="h-8 px-2 text-xs"
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reset
                    </Button>
                </div>
                {/* Show active filters summary */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {selectedCategory !== 'all' && (
                        <Badge variant="outline" className="text-xs capitalize">
                            {selectedCategory}
                        </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                        {priceRange[0]}-{priceRange[1]}
                    </Badge>
                    {selectedSort !== 'newest' && (
                        <Badge variant="outline" className="text-xs capitalize">
                            {selectedSort.replace('-', ' ')}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Item Type Filter */}
                <div>
                    <h3 className="text-sm font-medium mb-3">Item Type</h3>
                    <RadioGroup
                        value={selectedCategory}
                        onValueChange={onCategoryChange}
                    >
                        <div className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value="all" id="all" />
                            <Label htmlFor="all" className="cursor-pointer">All Items</Label>
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value="nft" id="nft" />
                            <Label htmlFor="nft" className="cursor-pointer">NFTs</Label>
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value="token" id="token" />
                            <Label htmlFor="token" className="cursor-pointer">Tokens</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="offer" id="offer" />
                            <Label htmlFor="offer" className="cursor-pointer">Offers</Label>
                        </div>
                    </RadioGroup>
                </div>

                <Separator />

                {/* Price Range Filter */}
                <div>
                    <h3 className="text-sm font-medium mb-3">Price Range</h3>
                    <Slider
                        value={priceRange}
                        onValueChange={onPriceRangeChange}
                        max={1000}
                        step={10}
                        className="mb-2"
                    />
                    <div className="flex items-center justify-between">
                        <div className="w-16">
                            <Badge variant="outline" className="w-full justify-center">
                                {priceRange[0]}
                            </Badge>
                        </div>
                        <div className="flex-1 px-2 text-center text-xs text-muted-foreground">
                            to
                        </div>
                        <div className="w-16">
                            <Badge variant="outline" className="w-full justify-center">
                                {priceRange[1]}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Additional Filter Options */}
                <Separator />

                <div>
                    <h3 className="text-sm font-medium mb-3">Sort By</h3>
                    <RadioGroup value={selectedSort} onValueChange={onSortChange}>
                        <div className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value="newest" id="sort-newest" />
                            <Label htmlFor="sort-newest" className="cursor-pointer">Newest First</Label>
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value="price-low" id="sort-price-low" />
                            <Label htmlFor="sort-price-low" className="cursor-pointer">Price: Low to High</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="price-high" id="sort-price-high" />
                            <Label htmlFor="sort-price-high" className="cursor-pointer">Price: High to Low</Label>
                        </div>
                    </RadioGroup>
                </div>
            </CardContent>
        </Card>
    );
};

export default ShopFilters;