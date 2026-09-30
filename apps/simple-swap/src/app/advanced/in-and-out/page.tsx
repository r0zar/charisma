"use client";

import { Header } from '@/components/layout/header';
import TakeProfitPage from '@/components/take-profit/TakeProfitPage';

export default function AdvancedTakeProfitPage() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <TakeProfitPage />
        </div>
    );
}
