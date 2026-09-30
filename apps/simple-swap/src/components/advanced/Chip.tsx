"use client";

/** A choice button for the Advanced pages: one of a row, highlighted when picked */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 rounded-lg border px-2 py-2 text-sm transition-colors ${active ? 'border-white/40 bg-white/[0.08] text-white' : 'border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white/90'}`}
        >
            {children}
        </button>
    );
}
