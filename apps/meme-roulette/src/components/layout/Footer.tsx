import React from 'react';
import Link from 'next/link';
import { ExternalLink, Github, MessageSquare, Twitter } from 'lucide-react';

const SOCIALS = [
    { href: 'https://x.com/CharismaBTC', label: 'Charisma on X', icon: Twitter },
    { href: 'https://github.com/r0zar/charisma', label: 'Charisma on GitHub', icon: Github },
    { href: 'https://discord.gg/ZvDmqQskpy', label: 'Charisma Discord', icon: MessageSquare },
];

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
    {
        title: 'Play',
        links: [
            { href: '/', label: 'This round' },
            { href: '/leaderboard', label: 'Leaderboard' },
            { href: '/referrals', label: 'Referrals' },
            { href: '/about', label: 'How it works' },
        ],
    },
    {
        title: 'Charisma',
        links: [
            { href: 'https://swap.charisma.rocks', label: 'Charisma Swap', external: true },
            { href: 'https://invest.charisma.rocks', label: 'Charisma Invest', external: true },
            { href: 'https://docs.charisma.rocks', label: 'Documentation', external: true },
        ],
    },
];

const linkClass = 'text-on-chrome-muted hover:text-on-chrome transition-colors duration-200 text-sm inline-flex items-center gap-1';

/** Site footer on the chrome bar. Hidden below lg, where the bottom nav takes its place. */
const Footer = () => (
    <footer className="mt-auto hidden border-t border-line bg-chrome text-on-chrome-muted lg:block">
        <div className="container mx-auto py-12">
            <div className="grid gap-10 md:grid-cols-4">
                <div className="md:col-span-2">
                    <Link href="/" className="mb-4 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                        <span className="text-[17px] font-bold tracking-tight text-on-chrome">
                            Meme Roulette <span className="text-sm font-medium text-on-chrome-muted">by Charisma</span>
                        </span>
                    </Link>
                    <p className="mb-6 max-w-sm text-sm leading-relaxed">
                        Everyone backs the meme they want pumped with CHA. When the timer ends, the wheel picks one and the whole pot buys it.
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

            <div className="mt-10 flex flex-col justify-between gap-2 border-t border-on-chrome-muted/20 pt-6 text-sm sm:flex-row">
                <span>© {new Date().getFullYear()} Charisma</span>
                <span>For entertainment only.</span>
            </div>
        </div>
    </footer>
);

export default Footer;
