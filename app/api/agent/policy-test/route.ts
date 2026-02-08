import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVault } from "@/lib/vault/service";
import { checkPolicy } from "@/lib/agent/policy-checker";
import { suiToMist, mistToSui, ACTION_SWAP } from "@/lib/constants";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

const PolicyTestSchema = z.object({
  vaultId: z.string().min(1),
  testType: z.enum([
    "exceed_budget",
    "break_cooldown",
    "exceed_per_tx",
    "unauthorized_agent",
    "expired_policy",
  ]),
  agentCapId: z.string().optional(),
});

interface TestResult {
  testType: string;
  testName: string;
  description: string;
  attempted: Record<string, string | number>;
  blocked: boolean;
  reason: string;
}

/**
 * Off-chain policy stress test endpoint.
 * Intentionally constructs violating requests to verify guardrails.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${secs} seconds.` },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const params = PolicyTestSchema.parse(body);
    const vault = await getVault(params.vaultId);

    let result: TestResult;

    switch (params.testType) {
      case "exceed_budget": {
        const remainingBudget = vault.policy.maxBudget - vault.totalSpent;
        // Try 2x the remaining budget (or 1 SUI if budget is exhausted)
        const attackAmount = remainingBudget > 0n
          ? remainingBudget + suiToMist(0.1)
          : suiToMist(1);

        const policyResult = checkPolicy({
          vault,
          amount: attackAmount,
          actionType: ACTION_SWAP,
          nowMs: Date.now(),
        });

        result = {
          testType: params.testType,
          testName: "Budget Overflow Attack",
          description: "Attempting to withdraw more than the remaining budget",
          attempted: {
            amount: `${mistToSui(attackAmount).toFixed(4)} SUI`,
            remainingBudget: `${mistToSui(remainingBudget).toFixed(4)} SUI`,
          },
          blocked: !policyResult.allowed,
          reason: policyResult.reason,
        };
        break;
      }

      case "break_cooldown": {
        // Simulate vault with txCount > 0 and a recent lastTxTime
        // so the cooldown check is always exercised
        const fakeLastTxTime = vault.lastTxTime > 0
          ? vault.lastTxTime
          : Date.now();
        const fakeNow = fakeLastTxTime + 1;
        const fakeTxCount = Math.max(vault.txCount, 1);

        const normalAmount = vault.policy.maxPerTx > 0n
          ? vault.policy.maxPerTx / 2n
          : suiToMist(0.01);
        const testAmount = normalAmount > 0n ? normalAmount : suiToMist(0.01);

        // Create a simulated vault with guaranteed txCount > 0
        const simulatedVault = {
          ...vault,
          txCount: fakeTxCount,
          lastTxTime: fakeLastTxTime,
        };

        const policyResult = checkPolicy({
          vault: simulatedVault,
          amount: testAmount,
          actionType: ACTION_SWAP,
          nowMs: fakeNow,
        });

        result = {
          testType: params.testType,
          testName: "Cooldown Bypass Attack",
          description: `Attempting to trade 1ms after last TX (cooldown: ${vault.policy.cooldownMs / 1000}s)`,
          attempted: {
            timeSinceLastTx: "1ms",
            cooldownRequired: `${vault.policy.cooldownMs / 1000}s`,
            amount: `${mistToSui(testAmount).toFixed(4)} SUI`,
          },
          blocked: !policyResult.allowed,
          reason: policyResult.reason,
        };
        break;
      }

      case "exceed_per_tx": {
        // Try 2x the per-tx limit
        const attackAmount = vault.policy.maxPerTx > 0n
          ? vault.policy.maxPerTx * 2n
          : suiToMist(10);

        const policyResult = checkPolicy({
          vault,
          amount: attackAmount,
          actionType: ACTION_SWAP,
          nowMs: Date.now(),
        });

        result = {
          testType: params.testType,
          testName: "Per-TX Limit Breach",
          description: "Attempting to withdraw 2x the per-transaction limit",
          attempted: {
            amount: `${mistToSui(attackAmount).toFixed(4)} SUI`,
            maxPerTx: `${mistToSui(vault.policy.maxPerTx).toFixed(4)} SUI`,
          },
          blocked: !policyResult.allowed,
          reason: policyResult.reason,
        };
        break;
      }

      case "unauthorized_agent": {
        // Check if provided capId is authorized
        const fakeCapId = params.agentCapId ?? "0x0000000000000000000000000000000000000000000000000000000000000000";
        const isAuthorized = vault.authorizedCaps.includes(fakeCapId);

        result = {
          testType: params.testType,
          testName: "Unauthorized Agent Access",
          description: "Attempting to use a non-authorized AgentCap",
          attempted: {
            capId: `${fakeCapId.slice(0, 10)}...${fakeCapId.slice(-6)}`,
            authorizedCount: vault.authorizedCaps.length,
          },
          blocked: !isAuthorized,
          reason: isAuthorized
            ? "Agent is authorized - test did not block"
            : `AgentCap not found in vault's ${vault.authorizedCaps.length} authorized cap(s). On-chain TX would abort with E_NOT_AUTHORIZED.`,
        };
        break;
      }

      case "expired_policy": {
        // Simulate request at expiry time + 1ms
        const fakeNow = vault.policy.expiresAt + 1;
        const normalAmount = suiToMist(0.01);

        const policyResult = checkPolicy({
          vault,
          amount: normalAmount,
          actionType: ACTION_SWAP,
          nowMs: fakeNow,
        });

        result = {
          testType: params.testType,
          testName: "Expired Policy Exploit",
          description: "Attempting to trade after policy expiration",
          attempted: {
            simulatedTime: new Date(fakeNow).toISOString(),
            expiresAt: new Date(vault.policy.expiresAt).toISOString(),
          },
          blocked: !policyResult.allowed,
          reason: policyResult.reason,
        };
        break;
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
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
