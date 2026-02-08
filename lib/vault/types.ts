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

export interface VaultEvent {
  txDigest: string;
  amount: number;
  actionType: number;
  totalSpent: number;
  remainingBudget: number;
  txCount: number;
  timestamp: number;
}

/**
 * Client-safe log entry for agent activity display.
 * Matches the shape returned by /api/agent/run (JSON-serializable, no server-only types).
 */
export interface AgentLogEntry {
  decision: {
    action: "swap_sui_to_usdc" | "swap_usdc_to_sui" | "hold";
    reasoning: string;
    confidence: number;
    params?: {
      amount: string;
      minOut?: string;
    };
  };
  policyCheck: {
    allowed: boolean;
    reason: string;
  };
  hasTransaction?: boolean;
  txDigest?: string | null;
  timestamp?: number;
}
