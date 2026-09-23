import type { RangeForm } from '@/components/range/RangeControls';

/** Bump the suffix when the shape changes; old entries are then ignored rather than migrated. */
export const RANGE_SETTINGS_KEY = 'range-swaps:settings:v1';

/** What survives a hard refresh. Tokens are stored by mainnet contract id and re-resolved on load. */
export interface StoredRangeSettings {
    form: RangeForm;
    tokenA: string | null;
    tokenB: string | null;
}

const FORM_KEYS: (keyof RangeForm)[] = ['sellPct', 'buyPct', 'perSwapUsd', 'intervalHours', 'runDays', 'tilt'];

const isForm = (v: unknown): v is RangeForm =>
    typeof v === 'object' && v !== null && FORM_KEYS.every((k) => Number.isFinite((v as Record<string, unknown>)[k]));

const isId = (v: unknown): v is string | null => v === null || typeof v === 'string';

/** Null when nothing is stored, storage is unavailable, or the entry is malformed. */
export function loadRangeSettings(): StoredRangeSettings | null {
    try {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(RANGE_SETTINGS_KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<StoredRangeSettings>;
        if (!isForm(v.form) || !isId(v.tokenA) || !isId(v.tokenB)) return null;
        return { form: v.form, tokenA: v.tokenA, tokenB: v.tokenB };
    } catch {
        return null;
    }
}

/** Silent on failure (quota, private mode): persistence is a convenience, not a requirement. */
export function saveRangeSettings(settings: StoredRangeSettings): void {
    try {
        if (typeof window === 'undefined') return;
        localStorage.setItem(RANGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // ignore
    }
}
