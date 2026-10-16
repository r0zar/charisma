import { formatChange } from '@/lib/format';

/** A percent change in green or red */
export function Change({ value, className = '' }: { value: number | null; className?: string }) {
  const tone = value === null || value === 0 ? 'text-ink-muted' : value > 0 ? 'text-success' : 'text-danger';
  return <span className={`tabular-nums ${tone} ${className}`}>{formatChange(value)}</span>;
}
