"use client";

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import InAndOutPage from '@/components/in-and-out/InAndOutPage';

export default function AdvancedInAndOutPage() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <InAndOutPage />
            <Footer />
        </div>
    );
}
