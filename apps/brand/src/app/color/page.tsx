import type { Metadata } from 'next';
import { PageIntro, SectionTitle } from '@/components/page-intro';
import { COLOR_GROUPS, color, colorValue, contrastOnBg, THEMES } from '@/lib/tokens';

export const metadata: Metadata = { title: 'Color' };

const TEXT_LIKE = /^(ink|accent-text|on-chrome|chrome-accent|blaze|success|danger|warning|gold|focus)/;

export default function ColorPage() {
  return (
    <>
      <PageIntro eyebrow="Color" title="Crimson by night, orange by day">
        Every colour is a semantic token with a Dark · RPG value and a Light · Bitcoin value. Use the token, never the hex, and the realm switch comes free.
      </PageIntro>
      {COLOR_GROUPS.map(group => (
        <section key={group.title}>
          <SectionTitle note={group.note}>{group.title}</SectionTitle>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[720px] border-collapse text-[14px] leading-[20px]">
              <thead>
                <tr className="text-left">
                  <th className="cx-label px-4 py-3">Token</th>
                  {THEMES.map(t => <th key={t.id} className="cx-label px-4 py-3">{t.name}</th>)}
                  <th className="cx-label px-4 py-3">Use</th>
                </tr>
              </thead>
              <tbody>
                {group.names.map(name => {
                  const t = color(name);
                  return (
                    <tr key={name} className="border-t border-line-soft align-top">
                      <td className="px-4 py-4"><code className="mono text-[13px] text-ink">{name}</code></td>
                      {THEMES.map(theme => {
                        const value = colorValue(t, theme.id);
                        return (
                          <td key={theme.id} className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {/* the swatch sits on its own realm's bg, so translucent layers read true */}
                              <span data-theme={theme.id} className="realm size-10 shrink-0 rounded-xl border border-line" style={{ boxShadow: `inset 0 0 0 40px ${value}` }} />
                              <span className="mono text-[12px] leading-[16px] text-ink-muted">
                                {value}
                                {TEXT_LIKE.test(name) && <><br />{contrastOnBg(t, theme.id).toFixed(1)}:1 on bg</>}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-ink-body max-w-[420px]">{t.usage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
