import Link from 'next/link';
import { Coins, ExternalLink, Github, MessageSquare, Twitter } from 'lucide-react';
import { advancedLinks } from './nav-links';

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
            { href: '/orders', label: 'Orders' },
            { href: '/analytics', label: 'Analytics' },
        ],
    },
    { title: 'Advanced', links: advancedLinks.map(({ href, label }) => ({ href, label })) },
    {
        title: 'Resources',
        links: [
            { href: 'https://docs.charisma.rocks', label: 'Documentation', external: true },
            { href: 'https://github.com/r0zar/charisma/blob/main/apps/simple-swap/README.md', label: 'API Guide', external: true },
            { href: 'https://explorer.hiro.so', label: 'Stacks Explorer', external: true },
        ],
    },
];

const linkClass = 'text-white/60 hover:text-white/90 transition-colors duration-200 text-sm inline-flex items-center gap-1';

/** Site footer: only links that go somewhere real */
export function Footer() {
    return (
        <footer className="relative mt-16 border-t border-white/[0.06]">
            <div className="absolute inset-0 bg-gradient-to-t from-white/[0.01] to-transparent pointer-events-none" />
            <div className="container relative z-10 py-16">
                <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <Link href="/" className="flex items-center gap-3 group mb-4">
                            <div className="h-8 w-8 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center backdrop-blur-sm group-hover:bg-white/[0.12] transition-all duration-200">
                                <Coins className="h-4 w-4 text-white/90" />
                            </div>
                            <span className="text-white/95 font-semibold tracking-tight">Charisma Swap</span>
                        </Link>
                        <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-xs">
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
                                    className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 hover:text-white/90 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200 backdrop-blur-sm"
                                >
                                    <Icon className="h-4 w-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {COLUMNS.map(column => (
                        <div key={column.title}>
                            <h3 className="text-white/90 font-semibold mb-4">{column.title}</h3>
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

                <div className="mt-12 pt-8 border-t border-white/[0.06] text-sm text-white/50">
                    © {new Date().getFullYear()} Charisma
                </div>
            </div>
        </footer>
    );
}
