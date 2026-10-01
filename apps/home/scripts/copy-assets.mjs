// Copies the crest and favicon set from @repo/brand into public/brand.
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = dirname(createRequire(import.meta.url).resolve('@repo/brand/tokens.json'));
mkdirSync(join(app, 'public', 'brand'), { recursive: true });
for (const dir of ['logos', 'favicons']) cpSync(join(pkg, dir), join(app, 'public', 'brand', dir), { recursive: true });
cpSync(join(pkg, 'favicons', 'favicon.ico'), join(app, 'public', 'favicon.ico'));
console.log('brand assets → public/brand');
