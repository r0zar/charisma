'use client';

import { useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useWallet } from '@/contexts/wallet-context';
import { pickMessage, shareLink } from '@/lib/share';

/**
 * The big "Share your pick" button: the phone's share sheet where there is one, otherwise a post on X.
 * More players means a bigger pot and a bigger pump, so it sits right where a player has just backed a meme.
 */
export function SharePickButton({ symbol, variant = 'default', className = '' }: { symbol: string; variant?: 'default' | 'outline'; className?: string }) {
    const { address } = useWallet();
    const [copied, setCopied] = useState(false);

    async function share() {
        const url = await shareLink(address);
        const text = pickMessage(symbol);
        if (navigator.share) {
            try { await navigator.share({ title: 'Meme Roulette', text, url }); } catch { /* the player closed the share sheet */ }
            return;
        }
        window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    }

    async function copy() {
        await navigator.clipboard.writeText(`${pickMessage(symbol)} ${await shareLink(address)}`);
        setCopied(true);
        toast.success('Copied: paste it anywhere');
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className={`flex w-full max-w-sm gap-2 ${className}`}>
            <Button size="lg" variant={variant} className="h-12 flex-1 text-base" onClick={share}>
                <Share2 className="h-5 w-5" /> Share your pick
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-4" onClick={copy} title="Copy the message and link" aria-label="Copy the message and link">
                {copied ? <Check className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
            </Button>
        </div>
    );
}
