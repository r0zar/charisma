import { getAllTokenData } from "@/lib/tokenService";
import ClientWrapper from "@/components/ClientWrapper";

export default async function Home() {
  // Pre-fetch token data on the server for hydration
  const tokens = await getAllTokenData();

  return <ClientWrapper initialTokens={tokens} />;
}
