import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Order Management | Simple Swap Admin',
    description: 'Monitor and manage limit orders and perpetual positions',
};

export default function AdminOrdersLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}