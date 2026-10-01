import type { Metadata } from 'next';
import { PageIntro, SectionTitle } from '@/components/page-intro';
import { tokens } from '@/lib/tokens';

export const metadata: Metadata = { title: 'Type' };

export default function TypePage() {
  const families = tokens.type.families as Record<string, string>;
  return (
    <>
      <PageIntro eyebrow="Type" title="Ysabeau Infant for words, DM Mono for numbers">
        Two families everywhere. Ysabeau Infant is the charisma.rocks face, a humanist sans with a calligraphic edge that suits the crest and stays clean in UI.
        DM Mono sets every amount, price, address and label in tabular figures.
      </PageIntro>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="cx-card"><p className="cx-label">Words</p><p className="mt-3 text-[56px] leading-[60px] font-extrabold">Ysabeau Infant</p><p className="mt-2 text-[15px] text-ink-muted">Variable 1–1000, with italic · SIL OFL 1.1</p></div>
        <div className="cx-card"><p className="cx-label">Numbers</p><p className="mono mt-3 text-[48px] leading-[60px]">22,711 STX</p><p className="mt-2 text-[15px] text-ink-muted">DM Mono 400 and 500 · SIL OFL 1.1</p></div>
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
                  fontFamily: families[(s as { family?: string }).family ?? group.family], fontSize: s.fontSize, lineHeight: s.lineHeight,
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
