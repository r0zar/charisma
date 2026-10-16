/** A tiny line of recent closes, green when it ends higher than it started */
export function Sparkline({ points, width = 120, height = 32 }: { points?: number[]; width?: number; height?: number }) {
  if (!points || points.length < 2) return <span className="text-ink-faint">—</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => `${((i / (points.length - 1)) * width).toFixed(1)},${(height - 2 - ((p - min) / span) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className={up ? 'text-success' : 'text-danger'}>
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
