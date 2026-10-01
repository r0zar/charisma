import type { Metadata } from 'next';
import { PageIntro, SectionTitle } from '@/components/page-intro';
import { Realms, SpecimenHtml } from '@/components/realms';
import { specimens } from '@/lib/tokens';

export const metadata: Metadata = { title: 'Components' };

const groups = [...new Set(specimens.map(s => s.group))];
// specimens wider than half the page get one full-width row per realm
const WIDE = new Set(['Header', 'Footer', 'Button', 'StatTile', 'StrategyCard', 'RouteDetails', 'EmptyState', 'Card']);

/** Turns the guide's markdown bullets and **bold** into simple markup */
function Guide({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('|'));
  const html = (l: string) => l
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code class="mono text-[13px] text-ink">$1</code>');
  return (
    <ul className="grid gap-2 text-[15px] leading-[22px] text-ink-body">
      {lines.slice(1).map(l => <li key={l} dangerouslySetInnerHTML={{ __html: html(l.replace(/^- /, '')) }} />)}
    </ul>
  );
}

export default function ComponentsPage() {
  return (
    <>
      <PageIntro eyebrow="Components" title="Drawn from the live apps">
        Twenty widget families, each taken from a real Charisma app and set in the system’s tokens. Every one is shown in both realms; the guide under it names the source file.
      </PageIntro>
      <nav className="flex flex-wrap gap-2">
        {specimens.map(s => <a key={s.name} href={`#${s.name}`} className="cx-chip cx-chip-round no-underline">{s.name}</a>)}
      </nav>
      {groups.map(group => (
        <section key={group}>
          <p className="eyebrow mt-20">{group}</p>
          {specimens.filter(s => s.group === group).map(s => (
            <article key={s.name} id={s.name} className="scroll-mt-24">
              <SectionTitle note={s.summary.replace(/`/g, '')}>{s.name}</SectionTitle>
              <Realms stack={WIDE.has(s.name)}><SpecimenHtml html={s.html} /></Realms>
              <div className="mt-6 max-w-[760px]"><Guide text={s.guide} /></div>
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
