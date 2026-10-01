import { THEMES } from '@/lib/tokens';

/** Renders the same content pinned to each realm, side by side */
export function Realms({ children, label = true, stack = false }: { children: React.ReactNode; label?: boolean; stack?: boolean }) {
  return (
    <div className={stack ? 'grid gap-4' : 'grid gap-4 lg:grid-cols-2'}>
      {THEMES.map(t => (
        <div key={t.id} data-theme={t.id} className="realm rounded-2xl border border-line overflow-hidden min-w-0">
          {label && <p className="cx-label px-5 pt-4">{t.name}</p>}
          <div className="overflow-x-auto">{children}</div>
        </div>
      ))}
    </div>
  );
}

/** Static specimen markup from @repo/brand (our own, trusted file) */
export function SpecimenHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
