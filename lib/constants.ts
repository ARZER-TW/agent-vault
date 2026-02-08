// Contract addresses
export const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID ??
  "0xbf74c7a7717e74f5074d024e27a5f6d2838d5025e4c67afd758286e3ba6bb31b";

export const MODULE_NAME = "agent_vault";

// Sui system objects
export const CLOCK_OBJECT_ID = "0x6";

// Network
export const SUI_NETWORK =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as "testnet" | "devnet" | "mainnet") ??
  "testnet";

// DeepBook V3
export const DEEPBOOK_POOL_KEY = "SUI_DBUSDC";

// Action types (matching Move contract)
export const ACTION_SWAP = 0;

export const ACTION_LABELS: Record<number, string> = {
  0: "Swap",
};

// Unit conversion
export function suiToMist(sui: number): bigint {
  return BigInt(Math.floor(sui * 1e9));
}

export function mistToSui(mist: bigint): number {
  return Number(mist) / 1e9;
}
