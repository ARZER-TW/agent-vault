import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getVault } from "@/lib/vault/service";
import { checkPolicy } from "@/lib/agent/policy-checker";
import { buildAgentWithdraw } from "@/lib/vault/ptb-builder";
import {
  executeSponsoredAgentTransaction,
  executeAgentTransaction,
} from "@/lib/auth/sponsored-tx";
import { getSuiClient } from "@/lib/sui/client";
import { suiToMist, mistToSui, ACTION_SWAP } from "@/lib/constants";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";
import type { VaultData, Policy } from "@/lib/vault/types";

const DemoRequestSchema = z.object({
  vaultId: z.string().min(1),
  agentCapId: z.string().min(1),
  ownerAddress: z.string().min(1),
  forceAmount: z.number().positive(),
  forceAction: z.enum(["swap_sui_to_usdc", "swap_usdc_to_sui"]).default("swap_sui_to_usdc"),
  scenario: z.enum(["normal", "over_limit", "cooldown", "budget_exceeded"]).optional(),
});

type DemoScenario = "normal" | "over_limit" | "cooldown" | "budget_exceeded";

/**
 * Build a synthetic vault for fully offline demo scenarios.
 * Each scenario shapes the vault state to trigger a specific policy outcome.
 */
function buildScenarioVault(vaultId: string, scenario: DemoScenario): VaultData {
  const basePolicy: Policy = {
    maxBudget: suiToMist(10),
    maxPerTx: suiToMist(1),
    allowedActions: [ACTION_SWAP],
    cooldownMs: 60_000,
    expiresAt: Date.now() + 3_600_000,
  };

  switch (scenario) {
    case "normal":
      return {
        id: vaultId,
        owner: "0xdemo_owner",
        balance: suiToMist(5),
        policy: basePolicy,
        authorizedCaps: [],
        totalSpent: 0n,
        lastTxTime: 0,
        txCount: 0,
      };

    case "over_limit":
      return {
        id: vaultId,
        owner: "0xdemo_owner",
        balance: suiToMist(5),
        policy: { ...basePolicy, maxPerTx: suiToMist(0.1) },
        authorizedCaps: [],
        totalSpent: 0n,
        lastTxTime: 0,
        txCount: 0,
      };

    case "cooldown":
      return {
        id: vaultId,
        owner: "0xdemo_owner",
        balance: suiToMist(5),
        policy: basePolicy,
        authorizedCaps: [],
        totalSpent: suiToMist(1),
        lastTxTime: Date.now() - 10_000,
        txCount: 1,
      };

    case "budget_exceeded":
      return {
        id: vaultId,
        owner: "0xdemo_owner",
        balance: suiToMist(5),
        policy: basePolicy,
        authorizedCaps: [],
        totalSpent: suiToMist(9.5),
        lastTxTime: 0,
        txCount: 5,
      };
  }
}

function buildScenarioDecision(scenario: DemoScenario, amount: number) {
  const labels: Record<DemoScenario, string> = {
    normal: "Normal trade within policy limits",
    over_limit: "Trade exceeds per-transaction limit",
    cooldown: "Trade during cooldown period",
    budget_exceeded: "Trade exceeds remaining budget",
  };

  return {
    action: "swap_sui_to_usdc" as const,
    reasoning: `[Demo: ${scenario}] ${labels[scenario]}`,
    confidence: 1.0,
    params: { amount: String(amount) },
  };
}

/**
 * Handle fully offline scenario demo (no external APIs).
 */
function handleOfflineScenario(
  vaultId: string,
  scenario: DemoScenario,
  forceAmount: number,
) {
  const vault = buildScenarioVault(vaultId, scenario);
  const amountMist = suiToMist(forceAmount);
  const decision = buildScenarioDecision(scenario, forceAmount);

  const policyCheck = checkPolicy({
    vault,
    amount: amountMist,
    actionType: ACTION_SWAP,
    nowMs: Date.now(),
  });

  const blocked = !policyCheck.allowed;

  return NextResponse.json({
    success: true,
    data: {
      scenario,
      blocked,
      reason: policyCheck.reason,
      decision,
      policyCheck,
      hasTransaction: false,
      txDigest: null,
      timestamp: Date.now(),
      vault: {
        id: vault.id,
        balance: mistToSui(vault.balance),
        totalSpent: mistToSui(vault.totalSpent),
        txCount: vault.txCount,
      },
      market: {
        midPrice: 1.5,
        timestamp: Date.now(),
        source: "fallback" as const,
      },
    },
  });
}

/**
 * Demo endpoint: skip LLM API, use forced amount for policy check.
 * With `scenario` param: fully offline demo (no external APIs at all).
 * Without `scenario`: on-chain demo using real vault + policy check + TX execution.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${secs} seconds.` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const params = DemoRequestSchema.parse(body);

    // Fully offline scenario mode
    if (params.scenario) {
      return handleOfflineScenario(params.vaultId, params.scenario, params.forceAmount);
    }

    // On-chain demo mode (original behavior)
    const vault = await getVault(params.vaultId);
    const amountMist = suiToMist(params.forceAmount);

    const decision = {
      action: params.forceAction as "swap_sui_to_usdc" | "swap_usdc_to_sui",
      reasoning: `[Demo Mode] Forced ${params.forceAction} with ${params.forceAmount} SUI`,
      confidence: 1.0,
      params: {
        amount: String(params.forceAmount),
      },
    };

    const policyCheck = checkPolicy({
      vault,
      amount: amountMist,
      actionType: ACTION_SWAP,
      nowMs: Date.now(),
    });

    if (!policyCheck.allowed) {
      return NextResponse.json({
        success: true,
        data: {
          decision,
          policyCheck,
          blocked: true,
          reason: policyCheck.reason,
          hasTransaction: false,
          txDigest: null,
          timestamp: Date.now(),
          vault: {
            id: vault.id,
            balance: mistToSui(vault.balance),
            totalSpent: mistToSui(vault.totalSpent),
            txCount: vault.txCount,
          },
        },
      });
    }

    const transaction = buildAgentWithdraw({
      vaultId: params.vaultId,
      agentCapId: params.agentCapId,
      amount: amountMist,
      actionType: ACTION_SWAP,
      recipientAddress: params.ownerAddress,
    });

    const agentKeyStr = process.env.AGENT_PRIVATE_KEY;
    if (!agentKeyStr) {
      return NextResponse.json(
        { success: false, error: "AGENT_PRIVATE_KEY is not set" },
        { status: 500 },
      );
    }
    const agentKeypair = Ed25519Keypair.fromSecretKey(agentKeyStr);

    let txDigest: string;
    try {
      txDigest = await executeSponsoredAgentTransaction({
        transaction,
        agentKeypair,
      });
    } catch {
      // Reset sender/gasOwner since sponsored path may have mutated the TX
      const agentAddr = agentKeypair.getPublicKey().toSuiAddress();
      transaction.setSender(agentAddr);
      transaction.setGasOwner(agentAddr);
      txDigest = await executeAgentTransaction({
        transaction,
        agentKeypair,
      });
    }

    const client = getSuiClient();
    await client.waitForTransaction({ digest: txDigest });
    const updatedVault = await getVault(params.vaultId);

    return NextResponse.json({
      success: true,
      data: {
        decision,
        policyCheck,
        blocked: false,
        reason: policyCheck.reason,
        hasTransaction: true,
        txDigest,
        timestamp: Date.now(),
        vault: {
          id: updatedVault.id,
          balance: mistToSui(updatedVault.balance),
          totalSpent: mistToSui(updatedVault.totalSpent),
          txCount: updatedVault.txCount,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request parameters", details: error.errors },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
