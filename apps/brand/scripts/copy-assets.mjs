// Copies the downloadable brand files from @repo/brand into public/brand, so the site serves them as static files.
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = dirname(createRequire(import.meta.url).resolve('@repo/brand/tokens.json'));
const out = join(app, 'public', 'brand');
mkdirSync(out, { recursive: true });
for (const dir of ['logos', 'favicons', 'fonts']) cpSync(join(pkg, dir), join(out, dir), { recursive: true });
for (const file of ['tokens.json', 'tokens.css']) cpSync(join(pkg, file), join(out, file));
cpSync(join(pkg, 'favicons', 'favicon.ico'), join(app, 'public', 'favicon.ico'));
console.log('brand assets → public/brand');
