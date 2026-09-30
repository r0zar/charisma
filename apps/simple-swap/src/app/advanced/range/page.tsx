"use client";

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import RangePage from '@/components/range/RangePage';

export default function AdvancedRangePage() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <RangePage />
            <Footer />
        </div>
    );
}
