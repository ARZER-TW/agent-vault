import { StableLayerClient } from "stable-layer-sdk";
import { SUI_NETWORK } from "@/lib/constants";
import { getSuiClient } from "./client";
import type { StablelayerPosition } from "@/lib/vault/types";

const slClients = new Map<string, StableLayerClient>();

/**
 * Stablelayer is currently mainnet-only.
 * On testnet, the client initializes but transactions will fail
 * because contracts are not deployed there.
 */
export const STABLELAYER_AVAILABLE = SUI_NETWORK === "mainnet";

/**
 * Get or create a StableLayerClient keyed by sender address.
 * Each sender gets its own client instance to avoid cross-contamination.
 */
export function getStableLayerClient(sender: string): StableLayerClient {
  let client = slClients.get(sender);
  if (!client) {
    client = new StableLayerClient({
      network: SUI_NETWORK as "mainnet" | "testnet",
      sender,
    });
    slClients.set(sender, client);
  }
  return client;
}

/**
 * Query Stablelayer total supply for display purposes.
 * Returns null if unavailable (e.g. on testnet).
 */
export async function getStablelayerTotalSupply(): Promise<string | null> {
  if (!STABLELAYER_AVAILABLE) return null;
  try {
    const client = getStableLayerClient("0x0");
    const supply = await client.getTotalSupply();
    return supply ?? null;
  } catch {
    return null;
  }
}

/**
 * Query Stablelayer position for a given address.
 * Currently returns null as position querying requires
 * on-chain object inspection (to be implemented when
 * Stablelayer provides position query APIs).
 */
export async function getStablelayerPosition(
  _ownerAddress: string,
): Promise<StablelayerPosition | null> {
  if (!STABLELAYER_AVAILABLE) return null;
  // Stablelayer SDK v2.0.0 does not expose position query methods.
  // Position tracking would require querying owned objects of
  // the StableVaultFarmEntity type. For now, return null.
  return null;
}

/**
 * Get estimated APY from Stablelayer.
 * Returns undefined if unavailable.
 */
export async function getStablelayerApy(): Promise<number | undefined> {
  if (!STABLELAYER_AVAILABLE) return undefined;
  // Stablelayer SDK v2.0.0 does not expose APY query.
  // This would need to be calculated from on-chain yield vault data.
  return undefined;
}
