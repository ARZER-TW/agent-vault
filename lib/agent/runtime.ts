import type { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { VaultData } from "@/lib/vault/types";
import type { OrderBookSnapshot } from "@/lib/sui/market";
import type { AgentDecision } from "./intent-parser";
import type { PolicyCheckResult } from "./policy-checker";
import { getVault } from "@/lib/vault/service";
import { getOrderBook, getSwapQuote } from "@/lib/sui/market";
import { getAgentDecision } from "./claude-client";
import { checkPolicy } from "./policy-checker";
import { buildAgentSwap, buildAgentWithdraw } from "@/lib/vault/ptb-builder";
import { suiToMist, mistToSui, ACTION_SWAP, DEEPBOOK_POOL_KEY } from "@/lib/constants";
import {
  executeSponsoredAgentTransaction,
  executeAgentTransaction,
} from "@/lib/auth/sponsored-tx";
import { getSuiClient } from "@/lib/sui/client";

export interface AgentRunResult {
  decision: AgentDecision;
  policyCheck: PolicyCheckResult;
  transaction: Transaction | null;
  txDigest: string | null;
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
 * 6. Execute transaction on-chain
 */
export async function runAgentCycle(params: {
  vaultId: string;
  agentCapId: string;
  agentAddress: string;
  ownerAddress: string;
  strategy?: string;
}): Promise<AgentRunResult> {
  const { vaultId, agentCapId, agentAddress, ownerAddress, strategy } = params;

  // Step 1: Fetch current vault state
  const vault = await getVault(vaultId);

  // Step 2: Get market data
  const orderBook = await getOrderBook(agentAddress, DEEPBOOK_POOL_KEY);

  // Step 3: Ask Claude for trading decision
  const decision = await getAgentDecision({ vault, orderBook, strategy });

  // Step 4: If hold, skip policy check and return
  if (decision.action === "hold") {
    return {
      decision,
      policyCheck: { allowed: true, reason: "Hold action - no transaction needed" },
      transaction: null,
      txDigest: null,
      vault,
      orderBook,
    };
  }

  // Step 5: Parse amount and check policy
  const amountSui = parseFloat(decision.params?.amount ?? "0");
  if (amountSui <= 0) {
    return {
      decision,
      policyCheck: { allowed: true, reason: "No amount specified - treating as hold" },
      transaction: null,
      txDigest: null,
      vault,
      orderBook,
    };
  }
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
      txDigest: null,
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
    // Get exact DEEP fee requirement from DeepBook, with 50% buffer
    let deepAmount = 0;
    try {
      const quote = await getSwapQuote(agentAddress, amountSui, DEEPBOOK_POOL_KEY);
      deepAmount = quote.deepRequired > 0 ? quote.deepRequired * 1.5 : 0;
    } catch {
      // If quote fails, use estimated fee (taker fee 0.1%, ~0.04 DEEP per SUI)
      deepAmount = amountSui * 0.04;
    }

    try {
      transaction = buildAgentSwap({
        vaultId,
        agentCapId,
        agentAddress,
        ownerAddress,
        amountMist,
        minOut,
        deepAmount,
        poolKey: DEEPBOOK_POOL_KEY,
      });
    } catch (swapBuildError) {
      // Fallback: simple withdraw if DeepBook swap build fails
      transaction = buildAgentWithdraw({
        vaultId,
        agentCapId,
        amount: amountMist,
        actionType: ACTION_SWAP,
        recipientAddress: ownerAddress,
      });
    }
  } else {
    // swap_usdc_to_sui - use simple withdraw
    // (reverse swap via DeepBook would need swapExactQuoteForBase)
    transaction = buildAgentWithdraw({
      vaultId,
      agentCapId,
      amount: amountMist,
      actionType: ACTION_SWAP,
      recipientAddress: ownerAddress,
    });
  }

  // Step 7: Execute transaction on-chain
  const agentKeyStr = process.env.AGENT_PRIVATE_KEY;
  if (!agentKeyStr) {
    throw new Error("AGENT_PRIVATE_KEY is not set");
  }
  const agentKeypair = Ed25519Keypair.fromSecretKey(agentKeyStr);

  let txDigest: string;
  try {
    // Try sponsored execution first (agent may not have SUI for gas)
    txDigest = await executeSponsoredAgentTransaction({
      transaction,
      agentKeypair,
    });
  } catch (sponsoredError) {
    // Fallback: agent pays own gas
    try {
      txDigest = await executeAgentTransaction({
        transaction,
        agentKeypair,
      });
    } catch (directError) {
      const sponsoredMsg = sponsoredError instanceof Error ? sponsoredError.message : String(sponsoredError);
      const directMsg = directError instanceof Error ? directError.message : String(directError);
      throw new Error(
        `Transaction execution failed. Sponsored: ${sponsoredMsg}. Direct: ${directMsg}`
      );
    }
  }

  // Wait for transaction to be confirmed before returning
  const client = getSuiClient();
  await client.waitForTransaction({ digest: txDigest });

  // Re-fetch vault with confirmed state
  const updatedVault = await getVault(vaultId);

  return {
    decision,
    policyCheck,
    transaction,
    txDigest,
    vault: updatedVault,
    orderBook,
  };
}
