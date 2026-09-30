"use client";

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import DcaPage from '@/components/dca/DcaPage';

export default function AdvancedDcaPage() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <DcaPage />
            <Footer />
        </div>
    );
}
