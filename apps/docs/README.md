# Charisma Docs

Source for [docs.charisma.rocks](https://docs.charisma.rocks), built with Docusaurus and styled by `@repo/brand`.

```bash
pnpm --filter apps-docs dev     # http://localhost:3004
pnpm --filter apps-docs build   # static site in build/
```

Pages live in `docs/<section>/`; each section's sidebar is generated from its folder (`sidebars.ts`).
Diagrams are Mermaid code blocks (```` ```mermaid ````). Deploys to Vercel on push to `main`.
