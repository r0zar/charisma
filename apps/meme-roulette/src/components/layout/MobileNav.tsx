'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Info, Menu, Trophy, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { href: '/referrals', label: 'Referrals', icon: Users },
    { href: '/about', label: 'About', icon: Info },
    { href: '/menu', label: 'Menu', icon: Menu },
];

const MobileNav = () => {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-[var(--mobile-nav-height,65px)] bg-chrome border-t border-line sm:hidden z-40">
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
                                    ? 'text-chrome-accent'
                                    : 'text-on-chrome-muted hover:text-on-chrome'
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
