import Link from "next/link";
import { ExternalLink, Github, MessageSquare, Twitter } from "lucide-react";

const SOCIALS = [
    { href: "https://x.com/CharismaBTC", label: "Charisma on X", icon: Twitter },
    { href: "https://github.com/r0zar/charisma", label: "Charisma on GitHub", icon: Github },
    { href: "https://discord.gg/ZvDmqQskpy", label: "Charisma Discord", icon: MessageSquare },
];

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
    {
        title: "Metadata",
        links: [
            { href: "/dashboard", label: "Dashboard" },
            { href: "/docs", label: "Docs" },
        ],
    },
    {
        title: "Charisma",
        links: [
            { href: "https://launchpad.charisma.rocks", label: "Charisma Launchpad", external: true },
            { href: "https://swap.charisma.rocks", label: "Charisma Swap", external: true },
            { href: "https://invest.charisma.rocks", label: "Charisma Invest", external: true },
        ],
    },
    {
        title: "Resources",
        links: [
            { href: "https://docs.charisma.rocks", label: "Documentation", external: true },
            { href: "https://github.com/r0zar/charisma", label: "GitHub", external: true },
            { href: "https://explorer.hiro.so", label: "Stacks Explorer", external: true },
        ],
    },
];

const linkClass = "text-on-chrome-muted hover:text-on-chrome transition-colors duration-200 text-sm inline-flex items-center gap-1";

/** Site footer: only links that go somewhere real */
export function SiteFooter() {
    return (
        <footer className="mt-auto border-t border-line bg-chrome text-on-chrome-muted">
            <div className="container py-16">
                <div className="grid gap-12 md:grid-cols-4">
                    <div>
                        <Link href="/" className="mb-4 flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                            <span className="text-on-chrome text-[17px] font-bold tracking-tight">Charisma <span className="text-chrome-accent">Metadata</span></span>
                        </Link>
                        <p className="mb-6 max-w-xs text-sm leading-relaxed">
                            Name, describe and picture your Stacks tokens. Metadata every wallet and app can read.
                        </p>
                        <div className="flex items-center gap-3">
                            {SOCIALS.map(({ href, label, icon: Icon }) => (
                                <a
                                    key={href}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    title={label}
                                    className="rounded-xl border border-on-chrome-muted/30 p-2 text-on-chrome-muted transition-all duration-200 hover:border-on-chrome hover:text-on-chrome"
                                >
                                    <Icon className="h-4 w-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {COLUMNS.map(column => (
                        <div key={column.title}>
                            <h3 className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-on-chrome">{column.title}</h3>
                            <ul className="space-y-3">
                                {column.links.map(link => (
                                    <li key={link.href}>
                                        {link.external ? (
                                            <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                                {link.label}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : (
                                            <Link href={link.href} className={linkClass}>{link.label}</Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-12 border-t border-on-chrome-muted/20 pt-8 text-sm">
                    © {new Date().getFullYear()} Charisma
                </div>
            </div>
        </footer>
    );
}
