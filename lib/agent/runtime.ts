import type { Transaction } from "@mysten/sui/transactions";
import type { VaultData } from "@/lib/vault/types";
import type { OrderBookSnapshot } from "@/lib/sui/market";
import type { AgentDecision } from "./intent-parser";
import type { PolicyCheckResult } from "./policy-checker";
import { getVault } from "@/lib/vault/service";
import { getOrderBook } from "@/lib/sui/market";
import { getAgentDecision } from "./claude-client";
import { checkPolicy } from "./policy-checker";
import { buildAgentSwap, buildAgentWithdraw } from "@/lib/vault/ptb-builder";
import { suiToMist, ACTION_SWAP, DEEPBOOK_POOL_KEY } from "@/lib/constants";

export interface AgentRunResult {
  decision: AgentDecision;
  policyCheck: PolicyCheckResult;
  transaction: Transaction | null;
  vault: VaultData;
  orderBook: OrderBookSnapshot;
}

/**
 * Execute one cycle of the agent loop:
 * 1. Fetch vault state
 * 2. Get market data
 * 3. Ask Claude for decision
 * 4. Validate against policy
 * 5. Build PTB if allowed
 */
export async function runAgentCycle(params: {
  vaultId: string;
  agentCapId: string;
  agentAddress: string;
  ownerAddress: string;
}): Promise<AgentRunResult> {
  const { vaultId, agentCapId, agentAddress, ownerAddress } = params;

  // Step 1: Fetch current vault state
  const vault = await getVault(vaultId);

  // Step 2: Get market data
  const orderBook = await getOrderBook(agentAddress, DEEPBOOK_POOL_KEY);

  // Step 3: Ask Claude for trading decision
  const decision = await getAgentDecision({ vault, orderBook });

  // Step 4: If hold, skip policy check and return
  if (decision.action === "hold") {
    return {
      decision,
      policyCheck: { allowed: true, reason: "Hold action - no transaction needed" },
      transaction: null,
      vault,
      orderBook,
    };
  }

  // Step 5: Parse amount and check policy
  const amountSui = parseFloat(decision.params?.amount ?? "0");
  const amountMist = suiToMist(amountSui);

  const policyCheck = checkPolicy({
    vault,
    amount: amountMist,
    actionType: ACTION_SWAP,
    nowMs: Date.now(),
  });

  if (!policyCheck.allowed) {
    return {
      decision,
      policyCheck,
      transaction: null,
      vault,
      orderBook,
    };
  }

  // Step 6: Build transaction
  const minOutRaw = decision.params?.minOut
    ? parseFloat(decision.params.minOut)
    : 0;
  // minOut for DeepBook is in quote asset units (DBUSDC, 6 decimals)
  const minOut = Math.floor(minOutRaw * 1e6);

  let transaction: Transaction;

  if (decision.action === "swap_sui_to_usdc") {
    transaction = buildAgentSwap({
      vaultId,
      agentCapId,
      agentAddress,
      ownerAddress,
      amountMist,
      minOut,
      deepAmount: 0,
      poolKey: DEEPBOOK_POOL_KEY,
    });
  } else {
    // swap_usdc_to_sui - for now use simple withdraw
    // (reverse swap via DeepBook would need swapExactQuoteForBase)
    transaction = buildAgentWithdraw({
      vaultId,
      agentCapId,
      amount: amountMist,
      actionType: ACTION_SWAP,
      recipientAddress: ownerAddress,
    });
  }

  return {
    decision,
    policyCheck,
    transaction,
    vault,
    orderBook,
  };
}
