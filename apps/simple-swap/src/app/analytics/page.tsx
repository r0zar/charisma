import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import AnalyticsPage, { count, usd } from '@/components/analytics/AnalyticsPage';
import { getPlatformStats } from '@/lib/analytics/platform-stats';

export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
    const stats = await getPlatformStats();
    const description = `${usd(stats.volumeUsd)} traded across ${count(stats.trades)} trades by ${count(stats.traders)} wallets. Live stats from Charisma, the Bitcoin DeFi exchange on Stacks.`;
    return {
        title: 'Charisma Analytics',
        description,
        openGraph: { title: 'Charisma, by the numbers', description },
        twitter: { card: 'summary_large_image', title: 'Charisma, by the numbers', description },
    };
}

export default async function Analytics() {
    const stats = await getPlatformStats();
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <AnalyticsPage stats={stats} />
            <Footer />
        </div>
    );
}
