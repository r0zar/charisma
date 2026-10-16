'use client';

import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

/** Copies the AI prompt. If the clipboard is blocked, opens the prompt as plain text to copy by hand. */
export function CopyPrompt({ text, className = '' }: { text: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied'>('idle');
  const copy = () =>
    navigator.clipboard.writeText(text)
      .then(() => { setState('copied'); setTimeout(() => setState('idle'), 2000); })
      .catch(() => window.open('/llms.txt', '_blank', 'noopener'));
  return (
    <button type="button" onClick={copy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover ${className}`}>
      {state === 'copied' ? <Check className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
      {state === 'copied' ? 'Copied. Paste it into your AI' : 'Copy AI prompt'}
    </button>
  );
}
