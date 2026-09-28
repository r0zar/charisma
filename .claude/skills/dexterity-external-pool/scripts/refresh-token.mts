// Force-refresh token metadata in the token cache (tokens.charisma.rocks).
// Run from apps/token-cache (it provides tsx + KV env), with this file copied there temporarily:
//   cd apps/token-cache && cp <skill>/scripts/refresh-token.mts ./.tmp-refresh.mts \
//     && node --env-file=.env.local --import tsx ./.tmp-refresh.mts <contractId>... ; rm -f ./.tmp-refresh.mts
// Afterwards re-check `identifier` (subnet tokens must use the BASE asset name; a refresh can overwrite it).
const { getTokenData } = await import('./src/lib/tokenService');
for (const id of process.argv.slice(2)) {
  const t = await getTokenData(id, true);
  console.log(id, '=>', t && { name: t.name, symbol: t.symbol, image: t.image, decimals: t.decimals, identifier: t.identifier, type: (t as any).type, base: (t as any).base });
}
process.exit(0);
