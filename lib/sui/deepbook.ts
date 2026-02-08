import { DeepBookClient } from "@mysten/deepbook-v3";
import { getSuiClient } from "./client";
import { SUI_NETWORK } from "@/lib/constants";

const dbClients = new Map<string, DeepBookClient>();

/**
 * Get or create a DeepBookClient for a specific address.
 * Uses per-address cache to avoid returning a client bound to the wrong sender.
 * @param address - The address used for swap sender context
 */
export function getDeepBookClient(address: string): DeepBookClient {
  let client = dbClients.get(address);
  if (!client) {
    client = new DeepBookClient({
      client: getSuiClient(),
      address,
      env: SUI_NETWORK as "testnet" | "mainnet",
    });
    dbClients.set(address, client);
  }
  return client;
}
