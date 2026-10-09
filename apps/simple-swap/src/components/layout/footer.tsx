import Link from 'next/link';
import { ExternalLink, Github, MessageSquare, Twitter } from 'lucide-react';
import { advancedLinks } from './nav-links';
import { TipJar } from './tip-jar';

const SOCIALS = [
    { href: 'https://x.com/CharismaBTC', label: 'Charisma on X', icon: Twitter },
    { href: 'https://github.com/r0zar/charisma', label: 'Charisma on GitHub', icon: Github },
    { href: 'https://discord.gg/ZvDmqQskpy', label: 'Charisma Discord', icon: MessageSquare },
];

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
    {
        title: 'Product',
        links: [
            { href: '/swap', label: 'Swap' },
            { href: '/activity', label: 'Activity' },
            { href: '/analytics', label: 'Analytics' },
        ],
    },
    { title: 'Advanced', links: advancedLinks.map(({ href, label }) => ({ href, label })) },
    {
        title: 'Build',
        links: [
            { href: 'https://launchpad.charisma.rocks/templates/sip10', label: 'Launch a token', external: true },
            { href: 'https://launchpad.charisma.rocks/templates/liquidity-pool', label: 'Create a pool', external: true },
            { href: 'https://invest.charisma.rocks/pools', label: 'Add liquidity', external: true },
        ],
    },
    {
        title: 'Resources',
        links: [
            { href: 'https://docs.charisma.rocks', label: 'Documentation', external: true },
            { href: 'https://github.com/r0zar/charisma/blob/main/apps/simple-swap/README.md', label: 'API Guide', external: true },
            { href: 'https://explorer.hiro.so', label: 'Stacks Explorer', external: true },
        ],
    },
];

const linkClass = 'text-on-chrome-muted hover:text-on-chrome transition-colors duration-200 text-sm inline-flex items-center gap-1';

/** Site footer: only links that go somewhere real */
export function Footer({ className = 'mt-16' }: { className?: string }) {
    return (
        <footer className={`relative border-t border-line bg-chrome text-on-chrome-muted ${className}`}>
            <div className="container relative z-10 py-16">
                <div className="grid gap-12 md:grid-cols-3 lg:grid-cols-5">
                    <div>
                        <Link href="/" className="flex items-center gap-3 group mb-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                            <span className="text-on-chrome text-[17px] font-bold tracking-tight">Charisma <span className="text-chrome-accent">Swap</span></span>
                        </Link>
                        <p className="text-on-chrome-muted text-sm leading-relaxed mb-6 max-w-xs">
                            An open-source exchange on Stacks. It belongs to no one and is open to everyone.
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
                                    className="p-2 rounded-xl border border-on-chrome-muted/30 text-on-chrome-muted hover:text-on-chrome hover:border-on-chrome transition-all duration-200 backdrop-blur-sm"
                                >
                                    <Icon className="h-4 w-4" />
                                </a>
                            ))}
                        </div>
                        <div className="mt-6">
                            <TipJar />
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

                <div className="mt-12 pt-8 border-t border-on-chrome-muted/20 text-sm text-on-chrome-muted">
                    © {new Date().getFullYear()} Charisma
                </div>
            </div>
        </footer>
    );
}
