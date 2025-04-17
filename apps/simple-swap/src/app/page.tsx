import { log } from "@repo/logger";
import { Link } from "@repo/ui/link";
import { SwapInterface } from "../components/swap-interface";

export const metadata = {
  title: "Charisma DEX - Token Swap",
  description: "Swap tokens on the Charisma Decentralized Exchange",
};

export default function Store() {
  log("Loading the DEX interface");

  return (
    <div className="container">
      <h1 className="title">
        Simple Swap
      </h1>
      <SwapInterface />
      <p className="description">
        Built on{" "}
        <Link href="https://docs.charisma.com/dexterity" newTab>
          Dexterity
        </Link>
        {" & "}
        <Link href="https://turborepo.org/" newTab>
          Cryptonomicon
        </Link>
      </p>
    </div>
  );
}
