import { getVaultIds, getVault } from "./actions";
import ClientWrapper from "@/components/ClientWrapper";
import { Vault } from "@repo/dexterity";

export default async function Home() {
  // Get the list of vault IDs
  const vaultIds = await getVaultIds();

  // Fetch each vault individually
  const vaultsPromises = vaultIds.map(id => getVault(id));
  const vaultsResponses = await Promise.all(vaultsPromises);

  // Filter out nulls and cast to Vault[] (nulls are removed by filter(Boolean))
  const vaults = vaultsResponses.filter(Boolean) as Vault[];

  return <ClientWrapper initialVaults={vaults} />;
}
