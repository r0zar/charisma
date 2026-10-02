import type { Metadata } from 'next';
import { PageIntro, SectionTitle } from '@/components/page-intro';
import { tokens } from '@/lib/tokens';

export const metadata: Metadata = { title: 'Type' };

export default function TypePage() {
  return (
    <>
      <PageIntro eyebrow="Type" title="Ysabeau Infant by night, Matter by day, DM Mono for numbers">
        Words take the realm&rsquo;s voice. Ysabeau Infant is the charisma.rocks face, a humanist sans with a calligraphic edge, and much of what makes the dark realm feel like an RPG.
        Matter is the Stacks Workshop face from Zesty: plain and confident, the Bitcoin voice. DM Mono sets every amount, price, address and label in tabular figures in both.
      </PageIntro>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="cx-card"><p className="cx-label">Words · Dark</p><p className="mt-3 text-[48px] leading-[60px] font-extrabold" style={{ fontFamily: '"Ysabeau Infant"' }}>Ysabeau Infant</p><p className="mt-2 text-[15px] text-ink-muted">Variable 1–1000, with italic · SIL OFL 1.1</p></div>
        <div className="cx-card"><p className="cx-label">Words · Light</p><p className="mt-3 text-[48px] leading-[60px] font-medium" style={{ fontFamily: 'Matter' }}>Matter</p><p className="mt-2 text-[15px] text-ink-muted">400 and 500; bolder weights render as Medium · Displaay</p></div>
        <div className="cx-card"><p className="cx-label">Numbers</p><p className="mono mt-3 text-[40px] leading-[60px]">22,711 STX</p><p className="mt-2 text-[15px] text-ink-muted">DM Mono 400 and 500, both realms · SIL OFL 1.1</p></div>
      </div>
      {tokens.type.groups.map(group => (
        <section key={group.name}>
          <SectionTitle>{group.name}</SectionTitle>
          <div className="flex flex-col divide-y divide-line-soft rounded-2xl border border-line">
            {group.styles.map(s => (
              <div key={s.name} className="grid gap-3 px-5 py-6 md:grid-cols-[200px_1fr]">
                <div>
                  <code className="mono text-[13px] text-ink">{s.name}</code>
                  <p className="mono mt-1 text-[12px] text-ink-muted">{s.fontSize} / {s.lineHeight} · {s.fontWeight}</p>
                  <p className="mt-2 text-[13px] leading-[18px] text-ink-muted">{s.usage}</p>
                </div>
                <p className="min-w-0 break-words" style={{
                  fontFamily: `var(--font-${(s as { family?: string }).family ?? group.family})`, fontSize: s.fontSize, lineHeight: s.lineHeight,
                  fontWeight: s.fontWeight, letterSpacing: (s as { letterSpacing?: string }).letterSpacing,
                  textTransform: s.name === 'label' ? 'uppercase' : undefined,
                }}>{s.sample}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
