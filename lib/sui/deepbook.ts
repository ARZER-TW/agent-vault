import { DeepBookClient } from "@mysten/deepbook-v3";
import { getSuiClient } from "./client";
import { SUI_NETWORK } from "@/lib/constants";

let dbClient: DeepBookClient | null = null;

/**
 * Get or create a DeepBookClient singleton.
 * @param address - The address used for swap sender context
 */
export function getDeepBookClient(address: string): DeepBookClient {
  if (!dbClient) {
    dbClient = new DeepBookClient({
      client: getSuiClient(),
      address,
      env: SUI_NETWORK as "testnet" | "mainnet",
    });
  }
  return dbClient;
}

/**
 * Reset the DeepBookClient (useful when address changes).
 */
export function resetDeepBookClient(): void {
  dbClient = null;
}
