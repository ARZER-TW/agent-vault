export interface Policy {
  maxBudget: bigint;
  maxPerTx: bigint;
  allowedActions: number[];
  cooldownMs: number;
  expiresAt: number;
}

export interface VaultData {
  id: string;
  owner: string;
  balance: bigint;
  policy: Policy;
  authorizedCaps: string[];
  totalSpent: bigint;
  lastTxTime: number;
  txCount: number;
}

export interface AgentCapData {
  id: string;
  vaultId: string;
}

export interface OwnerCapData {
  id: string;
  vaultId: string;
}

export type ActionType = "swap" | "limit_order";

export interface AgentIntent {
  action: "swap_sui_to_usdc" | "swap_usdc_to_sui" | "hold";
  amount: number;
  reason: string;
}

export interface SwapParams {
  direction: "sui_to_usdc" | "usdc_to_sui";
  amount: bigint;
  minOut: bigint;
}
