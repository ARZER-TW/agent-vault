import type { VaultData } from "@/lib/vault/types";

export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
}

/**
 * Pre-check an agent action against vault policy (off-chain).
 * This avoids wasting gas on transactions that will fail on-chain.
 */
export function checkPolicy(params: {
  vault: VaultData;
  amount: bigint;
  actionType: number;
  nowMs: number;
}): PolicyCheckResult {
  const { vault, amount, actionType, nowMs } = params;
  const { policy } = vault;

  // 0. Zero amount
  if (amount <= 0n) {
    return { allowed: false, reason: "Amount must be greater than zero" };
  }

  // 1. Expiry
  if (nowMs >= policy.expiresAt) {
    return { allowed: false, reason: "Policy has expired" };
  }

  // 2. Cooldown (skip for first tx)
  if (vault.txCount > 0) {
    const elapsed = nowMs - vault.lastTxTime;
    if (elapsed < policy.cooldownMs) {
      const remaining = policy.cooldownMs - elapsed;
      return {
        allowed: false,
        reason: `Cooldown active: ${remaining}ms remaining`,
      };
    }
  }

  // 3. Per-tx limit
  if (amount > policy.maxPerTx) {
    return {
      allowed: false,
      reason: `Amount ${amount} exceeds per-tx limit ${policy.maxPerTx}`,
    };
  }

  // 4. Total budget
  const remainingBudget = policy.maxBudget - vault.totalSpent;
  if (amount > remainingBudget) {
    return {
      allowed: false,
      reason: `Amount ${amount} exceeds remaining budget ${remainingBudget}`,
    };
  }

  // 5. Action whitelist
  if (!policy.allowedActions.includes(actionType)) {
    return {
      allowed: false,
      reason: `Action type ${actionType} is not whitelisted`,
    };
  }

  // 6. Sufficient balance
  if (amount > vault.balance) {
    return {
      allowed: false,
      reason: `Insufficient vault balance: ${vault.balance} < ${amount}`,
    };
  }

  return { allowed: true, reason: "Policy check passed" };
}
