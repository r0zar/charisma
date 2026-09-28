import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const OG_SIZE = { width: 1200, height: 630 };

/** The Workshop font, for share images. */
export async function ogFonts() {
  const [regular, medium] = await Promise.all([
    readFile(join(process.cwd(), 'public/fonts/Matter-Regular.woff')),
    readFile(join(process.cwd(), 'public/fonts/Matter-Medium.woff')),
  ]);
  return [
    { name: 'Matter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Matter', data: medium, weight: 500 as const, style: 'normal' as const },
  ];
}
