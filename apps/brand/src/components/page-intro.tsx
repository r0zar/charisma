export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="pt-16 pb-10 max-w-[760px]">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 text-[44px] leading-[48px] sm:text-[52px] sm:leading-[56px] font-extrabold tracking-[-0.015em]">{title}</h1>
      {children && <div className="mt-5 text-[19px] leading-[30px] text-ink-body">{children}</div>}
    </section>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mt-16 mb-6 max-w-[760px]">
      <h2 className="text-[26px] leading-[32px] font-bold">{children}</h2>
      {note && <p className="mt-2 text-[15px] leading-[22px] text-ink-muted">{note}</p>}
    </div>
  );
}
