"use client";

/** A choice button for the Advanced pages: one of a row, highlighted when picked */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 rounded-lg border px-2 py-2 text-sm transition-colors ${active ? 'border-ink/40 bg-surface-hover text-ink' : 'border-line bg-surface-sunken text-ink-muted hover:border-line-strong hover:text-ink'}`}
        >
            {children}
        </button>
    );
}
