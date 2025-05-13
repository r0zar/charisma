import Link from "next/link";
import { WalletConnector } from "@/components/wallet-connector";
import { HandCoinsIcon } from 'lucide-react';

export default function Header() {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur supports-[backdrop-flur]:bg-background/60">
            <div className="container flex h-16 items-center justify-between py-4">
                <div className="flex items-center gap-6 md:gap-10">
                    <Link
                        href="/"
                        className="flex items-center space-x-2 transition-opacity hover:opacity-80"
                    >
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-primary via-primary/80 to-primary/50">
                            <HandCoinsIcon className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="hidden tracking-tight text-foreground sm:inline-block text-lg">
                            <span className="font-bold">Charisma</span>{" "}
                            <span className="text-primary">Invest</span>
                        </span>
                    </Link>

                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/pools"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Liquidity Pools
                        </Link>
                    </nav>

                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/sublinks"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Sublinks
                        </Link>
                    </nav>

                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/listing"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Listings
                        </Link>
                    </nav>
                </div>

                <div className="relative flex items-center gap-4">
                    <WalletConnector className="ml-auto" />
                </div>
            </div>
        </header>
    );
} 