import Link from "next/link";
import { DatabaseZap, Search } from 'lucide-react'; // Example icons

export default function Header() {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 backdrop-blur supports-[backdrop-blur]:bg-background/60">
            <div className="container flex h-16 items-center justify-between py-4">
                <div className="flex items-center gap-6 md:gap-10">
                    {/* Branding */}
                    <Link
                        href="/"
                        className="flex items-center space-x-2 transition-opacity hover:opacity-80"
                    >
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-500 via-blue-600 to-blue-700">
                            {/* Placeholder Icon */}
                            <DatabaseZap className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="hidden tracking-tight text-foreground sm:inline-block text-lg">
                            {/* Adjusted Branding */}
                            <span className="font-bold">Token</span> Cache
                        </span>
                    </Link>

                    {/* Navigation Links */}
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Tokens
                        </Link>
                        <Link
                            href="/inspect"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Inspect
                        </Link>
                        <Link
                            href="/stats"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Stats
                        </Link>
                    </nav>
                </div>

                {/* Right side - could add WalletConnector if needed later */}
                <div className="relative flex items-center gap-4">
                    {/* Placeholder for future elements like WalletConnector */}
                </div>
            </div>
        </header>
    );
} 