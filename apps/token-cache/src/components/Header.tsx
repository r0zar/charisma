import Link from "next/link";
import { ThemeToggle } from "@repo/brand/react";
import { navigationLinks } from "@/lib/nav-links";

export default function Header() {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-line bg-chrome text-on-chrome">
            <div className="container flex h-16 items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-8">
                    <Link href="/" className="flex shrink-0 items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                        <span className="hidden text-[18px] font-bold tracking-tight sm:inline-block">
                            Charisma <span className="text-chrome-accent">Tokens</span>
                        </span>
                    </Link>

                    {/* scrolls sideways on small screens rather than hiding sections */}
                    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
                        {navigationLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome md:px-4"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <ThemeToggle className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome" />
            </div>
        </header>
    );
}
