import Link from "next/link";
import { BookOpen, LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@repo/brand/react";
import { WalletConnector } from "@/components/wallet-connector";

const NAV = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/docs", label: "Docs", icon: BookOpen },
];

export function SiteHeader() {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-line bg-chrome text-on-chrome">
            <div className="container flex h-16 items-center justify-between">
                <div className="flex items-center gap-4 md:gap-8">
                    <Link href="/" className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                        <span className="hidden text-[18px] font-bold tracking-tight sm:inline-block">
                            Charisma <span className="text-chrome-accent">Metadata</span>
                        </span>
                    </Link>

                    <nav aria-label="Primary" className="flex items-center gap-1">
                        {NAV.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                title={label}
                                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome md:px-4"
                            >
                                <Icon className="h-4 w-4 md:hidden" />
                                <span className="hidden md:inline">{label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome" />
                    <WalletConnector />
                </div>
            </div>
        </header>
    );
}
