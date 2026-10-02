import { Coins, Disc3, Gift } from 'lucide-react';

const STEPS = [
    { icon: Coins, title: 'Back a meme', text: 'Put CHA behind the meme you want pumped. Your CHA joins the pot.' },
    { icon: Disc3, title: 'The wheel spins', text: 'When the timer ends, one meme wins. Each slice is sized by its stake.' },
    { icon: Gift, title: 'The pot buys the winner', text: 'All the CHA buys the winning meme, and everyone gets their share of it.' },
];

/** The game in three lines. */
export function HowItWorks() {
    return (
        <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="rounded-xl border border-line bg-surface p-4">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent">{i + 1}</span>
                        <Icon className="h-4 w-4 text-accent-text" />
                    </div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-ink-muted">{text}</p>
                </li>
            ))}
        </ol>
    );
}
