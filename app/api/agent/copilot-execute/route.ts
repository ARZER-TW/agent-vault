import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getVault } from "@/lib/vault/service";
import { getSwapQuote } from "@/lib/sui/market";
import { checkPolicy } from "@/lib/agent/policy-checker";
import { buildAgentSwap, buildAgentWithdraw } from "@/lib/vault/ptb-builder";
import {
  executeSponsoredAgentTransaction,
  executeAgentTransaction,
} from "@/lib/auth/sponsored-tx";
import { getSuiClient } from "@/lib/sui/client";
import { suiToMist, mistToSui, ACTION_SWAP, DEEPBOOK_POOL_KEY } from "@/lib/constants";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

const RequestSchema = z.object({
  vaultId: z.string().min(1),
  agentCapId: z.string().min(1),
  agentAddress: z.string().min(1),
  ownerAddress: z.string().min(1),
  action: z.enum(["swap_sui_to_usdc", "swap_usdc_to_sui"]),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Must be a numeric string"),
  minOut: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${secs} seconds.` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const params = RequestSchema.parse(body);

    // Re-validate policy before execution (state may have changed since suggest)
    const vault = await getVault(params.vaultId);
    const amountSui = parseFloat(params.amount);
    const amountMist = suiToMist(amountSui);

    const policyCheck = checkPolicy({
      vault,
      amount: amountMist,
      actionType: ACTION_SWAP,
      nowMs: Date.now(),
    });

    if (!policyCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: `Policy check failed: ${policyCheck.reason}`,
      }, { status: 403 });
    }

    // Build transaction
    const minOutRaw = params.minOut ? parseFloat(params.minOut) : 0;
    const minOut = Math.floor(minOutRaw * 1e6);

    let transaction;

    if (params.action === "swap_sui_to_usdc") {
      let deepAmount = 0;
      try {
        const quote = await getSwapQuote(params.agentAddress, amountSui, DEEPBOOK_POOL_KEY);
        deepAmount = quote.deepRequired > 0 ? quote.deepRequired * 1.5 : 0;
      } catch {
        deepAmount = amountSui * 0.04;
      }

      try {
        transaction = buildAgentSwap({
          vaultId: params.vaultId,
          agentCapId: params.agentCapId,
          agentAddress: params.agentAddress,
          ownerAddress: params.ownerAddress,
          amountMist,
          minOut,
          deepAmount,
          poolKey: DEEPBOOK_POOL_KEY,
        });
      } catch {
        try {
          transaction = buildAgentWithdraw({
            vaultId: params.vaultId,
            agentCapId: params.agentCapId,
            amount: amountMist,
            actionType: ACTION_SWAP,
            recipientAddress: params.ownerAddress,
          });
        } catch (withdrawError) {
          const errorMsg = withdrawError instanceof Error
            ? withdrawError.message
            : String(withdrawError);
          return NextResponse.json(
            { success: false, error: `PTB build failed: ${errorMsg}` },
            { status: 500 },
          );
        }
      }
    } else {
      try {
        transaction = buildAgentWithdraw({
          vaultId: params.vaultId,
          agentCapId: params.agentCapId,
          amount: amountMist,
          actionType: ACTION_SWAP,
          recipientAddress: params.ownerAddress,
        });
      } catch (buildError) {
        const errorMsg = buildError instanceof Error ? buildError.message : String(buildError);
        return NextResponse.json(
          { success: false, error: `PTB build failed: ${errorMsg}` },
          { status: 500 },
        );
      }
    }

    // Execute transaction
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
      const agentAddr = agentKeypair.getPublicKey().toSuiAddress();
      transaction.setSender(agentAddr);
      transaction.setGasOwner(agentAddr);
      try {
        txDigest = await executeAgentTransaction({
          transaction,
          agentKeypair,
        });
      } catch (directError) {
        const directMsg = directError instanceof Error ? directError.message : String(directError);
        return NextResponse.json(
          { success: false, error: `Transaction execution failed: ${directMsg}` },
          { status: 500 },
        );
      }
    }

    // Wait for confirmation and re-fetch vault
    const client = getSuiClient();
    await client.waitForTransaction({ digest: txDigest });
    const updatedVault = await getVault(params.vaultId);

    return NextResponse.json({
      success: true,
      data: {
        txDigest,
        vault: {
          id: updatedVault.id,
          balance: mistToSui(updatedVault.balance),
          totalSpent: mistToSui(updatedVault.totalSpent),
          txCount: updatedVault.txCount,
        },
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request parameters", details: error.errors },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
