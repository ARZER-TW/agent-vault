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

const DemoRequestSchema = z.object({
  vaultId: z.string().min(1),
  agentCapId: z.string().min(1),
  ownerAddress: z.string().min(1),
  forceAmount: z.number().positive(),
  forceAction: z.enum(["swap_sui_to_usdc", "swap_usdc_to_sui"]).default("swap_sui_to_usdc"),
});

/**
 * Demo endpoint: skip Claude API, use forced amount for policy check.
 * Executes agent_withdraw to demonstrate policy enforcement on-chain.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = DemoRequestSchema.parse(body);

    const vault = await getVault(params.vaultId);
    const amountMist = suiToMist(params.forceAmount);

    // Build a synthetic decision
    const decision = {
      action: params.forceAction as "swap_sui_to_usdc" | "swap_usdc_to_sui",
      reasoning: `[Demo Mode] Forced ${params.forceAction} with ${params.forceAmount} SUI`,
      confidence: 1.0,
      params: {
        amount: String(params.forceAmount),
      },
    };

    // Policy check
    const policyCheck = checkPolicy({
      vault,
      amount: amountMist,
      actionType: ACTION_SWAP,
      nowMs: Date.now(),
    });

    // If policy blocks, return immediately (no TX execution)
    if (!policyCheck.allowed) {
      return NextResponse.json({
        success: true,
        data: {
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
        },
      });
    }

    // Build and execute agent_withdraw
    const transaction = buildAgentWithdraw({
      vaultId: params.vaultId,
      agentCapId: params.agentCapId,
      amount: amountMist,
      actionType: ACTION_SWAP,
      recipientAddress: params.ownerAddress,
    });

    const agentKeyStr = process.env.AGENT_PRIVATE_KEY;
    if (!agentKeyStr) {
      throw new Error("AGENT_PRIVATE_KEY is not set");
    }
    const agentKeypair = Ed25519Keypair.fromSecretKey(agentKeyStr);

    let txDigest: string;
    try {
      txDigest = await executeSponsoredAgentTransaction({
        transaction,
        agentKeypair,
      });
    } catch {
      txDigest = await executeAgentTransaction({
        transaction,
        agentKeypair,
      });
    }

    // Wait for transaction confirmation and re-fetch vault
    const client = getSuiClient();
    await client.waitForTransaction({ digest: txDigest });
    const updatedVault = await getVault(params.vaultId);

    return NextResponse.json({
      success: true,
      data: {
        decision,
        policyCheck,
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
