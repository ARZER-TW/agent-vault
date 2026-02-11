import type { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { VaultData } from "@/lib/vault/types";
import type { OrderBookSnapshot } from "@/lib/sui/market";
import type { AgentDecision } from "./intent-parser";
import type { PolicyCheckResult } from "./policy-checker";
import { getVault } from "@/lib/vault/service";
import { getOrderBook } from "@/lib/sui/market";
import { getAgentDecision } from "./llm-client";
import { checkPolicy } from "./policy-checker";
import { buildAgentWithdraw } from "@/lib/vault/ptb-builder";
import {
  buildAgentCetusSwap,
  buildAgentStableMint,
  buildAgentStableBurn,
  buildAgentStableClaim,
} from "@/lib/vault/ptb-agent";
import {
  suiToMist,
  ACTION_SWAP,
  ACTION_STABLE_MINT,
  ACTION_STABLE_BURN,
  ACTION_STABLE_CLAIM,
} from "@/lib/constants";
import {
  executeSponsoredAgentTransaction,
  executeAgentTransaction,
} from "@/lib/auth/sponsored-tx";
import { getSuiClient } from "@/lib/sui/client";
import { STABLELAYER_AVAILABLE } from "@/lib/sui/stablelayer";

export interface AgentRunError {
  step: "market_data" | "llm_decision" | "policy_check" | "ptb_build" | "tx_execute";
  error: string;
}

export interface AgentRunResult {
  decision: AgentDecision;
  policyCheck: PolicyCheckResult;
  transaction: Transaction | null;
  txDigest: string | null;
  vault: VaultData;
  orderBook: OrderBookSnapshot;
  error?: AgentRunError;
}

/** Actions that withdraw SUI from the vault */
const WITHDRAWAL_ACTIONS = new Set<string>([
  "swap_sui_to_usdc",
  "swap_usdc_to_sui",
  "stable_mint",
]);

/** Map LLM action string to Move contract action type constant */
function getActionType(action: string): number {
  switch (action) {
    case "swap_sui_to_usdc":
    case "swap_usdc_to_sui":
      return ACTION_SWAP;
    case "stable_mint":
      return ACTION_STABLE_MINT;
    case "stable_burn":
      return ACTION_STABLE_BURN;
    case "stable_claim":
      return ACTION_STABLE_CLAIM;
    default:
      return ACTION_SWAP;
  }
}

/**
 * Build the appropriate transaction based on the agent's decision.
 * All builders are async because Cetus route finding requires network calls.
 */
async function buildTransaction(params: {
  action: string;
  vaultId: string;
  agentCapId: string;
  agentAddress: string;
  ownerAddress: string;
  amountMist?: bigint;
}): Promise<Transaction> {
  const { action, vaultId, agentCapId, agentAddress, ownerAddress, amountMist } = params;

  switch (action) {
    case "swap_sui_to_usdc":
      try {
        return await buildAgentCetusSwap({
          vaultId,
          agentCapId,
          ownerAddress,
          amountMist: amountMist!,
        });
      } catch (cetusError) {
        // Fallback: simple withdraw if Cetus swap route not available
        console.warn(
          "[runtime] Cetus swap failed, falling back to withdraw:",
          cetusError instanceof Error ? cetusError.message : String(cetusError),
        );
        return buildAgentWithdraw({
          vaultId,
          agentCapId,
          amount: amountMist!,
          actionType: ACTION_SWAP,
          recipientAddress: ownerAddress,
        });
      }

    case "swap_usdc_to_sui":
      // Vault holds SUI only; reverse swap sends SUI directly to owner
      return buildAgentWithdraw({
        vaultId,
        agentCapId,
        amount: amountMist!,
        actionType: ACTION_SWAP,
        recipientAddress: ownerAddress,
      });

    case "stable_mint":
      return buildAgentStableMint({
        vaultId,
        agentCapId,
        agentAddress,
        ownerAddress,
        amountMist: amountMist!,
      });

    case "stable_burn":
      return buildAgentStableBurn({
        vaultId,
        agentCapId,
        agentAddress,
        ownerAddress,
      });

    case "stable_claim":
      return buildAgentStableClaim({
        agentAddress,
        ownerAddress,
      });

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Execute one cycle of the agent loop:
 * 1. Fetch vault state
 * 2. Get market data via Cetus Aggregator
 * 3. Ask LLM for trading decision
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

  // Step 2: Get market data via Cetus Aggregator
  const orderBook = await getOrderBook(agentAddress);

  // Step 3: Ask LLM for trading decision (with timeout + parse fallback)
  let decision: AgentDecision;
  try {
    decision = await getAgentDecision({ vault, orderBook, strategy });
  } catch (llmError) {
    const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
    console.warn("[runtime] LLM decision failed, falling back to hold:", errorMsg);
    decision = {
      action: "hold",
      reasoning: `[Fallback] LLM unavailable: ${errorMsg}`,
      confidence: 0,
      params: undefined,
    };
    return {
      decision,
      policyCheck: { allowed: true, reason: "Hold fallback - no transaction needed" },
      transaction: null,
      txDigest: null,
      vault,
      orderBook,
      error: { step: "llm_decision", error: errorMsg },
    };
  }

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

  // Step 4b: Confidence threshold - override to hold if too low
  const MIN_CONFIDENCE = 0.5;
  if (decision.confidence < MIN_CONFIDENCE) {
    return {
      decision: {
        ...decision,
        action: "hold" as const,
        reasoning: `Low confidence (${(decision.confidence * 100).toFixed(0)}%), holding. Original: ${decision.reasoning}`,
      },
      policyCheck: { allowed: true, reason: "Low confidence - auto hold" },
      transaction: null,
      txDigest: null,
      vault,
      orderBook,
    };
  }

  // Step 4c: Stablelayer availability check
  if (decision.action.startsWith("stable_") && !STABLELAYER_AVAILABLE) {
    return {
      decision: {
        ...decision,
        action: "hold" as const,
        reasoning: `Stablelayer is mainnet-only (current network unavailable). Original: ${decision.reasoning}`,
      },
      policyCheck: { allowed: true, reason: "Stablelayer unavailable on current network" },
      transaction: null,
      txDigest: null,
      vault,
      orderBook,
    };
  }

  // Step 5: Determine action type and whether withdrawal is needed
  const actionType = getActionType(decision.action);
  const requiresWithdrawal = WITHDRAWAL_ACTIONS.has(decision.action);

  let amountMist: bigint | undefined;
  if (requiresWithdrawal) {
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
    amountMist = suiToMist(amountSui);
  }

  // Step 5b: Check policy (amount is optional for non-withdrawal actions)
  const policyCheck = checkPolicy({
    vault,
    actionType,
    nowMs: Date.now(),
    amount: amountMist,
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
  let transaction: Transaction;
  try {
    transaction = await buildTransaction({
      action: decision.action,
      vaultId,
      agentCapId,
      agentAddress,
      ownerAddress,
      amountMist,
    });
  } catch (buildError) {
    const errorMsg = buildError instanceof Error ? buildError.message : String(buildError);
    console.warn("[runtime] PTB build failed:", errorMsg);
    return {
      decision,
      policyCheck,
      transaction: null,
      txDigest: null,
      vault,
      orderBook,
      error: { step: "ptb_build", error: errorMsg },
    };
  }

  // Step 7: Execute transaction on-chain
  const agentKeyStr = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!agentKeyStr) {
    return {
      decision,
      policyCheck,
      transaction: null,
      txDigest: null,
      vault,
      orderBook,
      error: { step: "tx_execute", error: "AGENT_PRIVATE_KEY is not set" },
    };
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
    const agentAddr = agentKeypair.getPublicKey().toSuiAddress();
    transaction.setSender(agentAddr);
    transaction.setGasOwner(agentAddr);
    try {
      txDigest = await executeAgentTransaction({
        transaction,
        agentKeypair,
      });
    } catch (directError) {
      const sponsoredMsg = sponsoredError instanceof Error ? sponsoredError.message : String(sponsoredError);
      const directMsg = directError instanceof Error ? directError.message : String(directError);
      const errorMsg = `Sponsored: ${sponsoredMsg}. Direct: ${directMsg}`;
      console.warn("[runtime] Transaction execution failed:", errorMsg);
      return {
        decision,
        policyCheck,
        transaction,
        txDigest: null,
        vault,
        orderBook,
        error: { step: "tx_execute", error: errorMsg },
      };
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
