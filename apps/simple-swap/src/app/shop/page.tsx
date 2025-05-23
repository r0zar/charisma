import { Suspense } from 'react';
import ShopPage from '@/components/shop/ShopPage';
import EpicLoadingScreen from '@/components/shop/EpicLoadingScreen';
import { ShopService } from '@/lib/shop/shop-service';

// Server component to fetch data
export default async function ShopPageRoute() {
    // Use the centralized service to get all shop items
    const allItems = await ShopService.getAllShopItems();

    return (
        <Suspense fallback={<EpicLoadingScreen />}>
            <ShopPage initialItems={allItems} />
        </Suspense>
    );
}