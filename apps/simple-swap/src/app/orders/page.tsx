"use client";

import { Header } from "@/components/header";
import OrdersPanel from "@/components/orders-panel";

export default function OrdersPage() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <OrdersPanel />
        </div>
    );
} 