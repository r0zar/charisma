"use client";

import { Header } from '@/components/layout/header';
import TargetPage from '@/components/target/TargetPage';

export default function AdvancedTargetPage() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <TargetPage />
        </div>
    );
}
