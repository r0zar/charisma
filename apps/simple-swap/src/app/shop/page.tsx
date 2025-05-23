import { Suspense } from 'react';
import { Metadata } from 'next';
import ShopPage from '@/components/shop/ShopPage';
import { ShopService } from '@/lib/shop/shop-service';

export const metadata: Metadata = {
    title: 'Charisma Marketplace - Trade Tokens & Place Bids',
    description: 'Trade tokens, place bids on offers, and discover new opportunities in the Charisma ecosystem. Join the decentralized marketplace for OTC token trading.',
    openGraph: {
        title: 'Charisma Marketplace',
        description: 'Trade tokens, place bids on offers, and discover new opportunities in the Charisma ecosystem.',
        type: 'website',
        url: '/shop',
        siteName: 'Charisma',
        images: [
            {
                url: '/charisma.png',
                width: 800,
                height: 600,
                alt: 'Charisma Logo',
                type: 'image/png',
            }
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Charisma Marketplace',
        description: 'Trade tokens, place bids on offers, and discover new opportunities in the Charisma ecosystem.',
    },
    other: {
        'og:logo': 'https://charisma.rocks/charisma.png',
    },
};

// Server component to fetch data
export default async function ShopPageRoute() {
    // Use the centralized service to get all shop items
    const allItems = await ShopService.getAllShopItems();

    return (
        <ShopPage initialItems={allItems} />
    );
}