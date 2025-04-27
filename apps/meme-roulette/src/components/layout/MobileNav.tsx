'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn utility exists

const navItems = [
    { href: '/', label: 'Hub', icon: Home },
    // { href: '/portfolio', label: 'Portfolio', icon: Wallet },
    // Add other items as needed
];

const MobileNav = () => {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-[var(--mobile-nav-height,70px)] bg-background border-t border-border/50 shadow-lg sm:hidden z-40">
            <div className="flex justify-around items-center h-full px-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex flex-col items-center justify-center text-xs font-medium w-full h-full transition-colors duration-200',
                                isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="mt-1">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNav;
