import { aiPrompt } from '@/lib/ai-prompt';

/** GET /llms.txt — the whole API in one prompt, for AI assistants */
export function GET() {
  return new Response(aiPrompt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'Access-Control-Allow-Origin': '*' },
  });
}
