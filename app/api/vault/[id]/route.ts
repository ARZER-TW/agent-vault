import { NextRequest, NextResponse } from "next/server";
import { getVault } from "@/lib/vault/service";
import { mistToSui } from "@/lib/constants";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${secs} seconds.` },
      { status: 429 },
    );
  }

  try {
    const vault = await getVault(params.id);

    return NextResponse.json({
      success: true,
      data: {
        id: vault.id,
        owner: vault.owner,
        balance: mistToSui(vault.balance),
        totalSpent: mistToSui(vault.totalSpent),
        txCount: vault.txCount,
        lastTxTime: vault.lastTxTime,
        authorizedCaps: vault.authorizedCaps,
        policy: {
          maxBudget: mistToSui(vault.policy.maxBudget),
          maxPerTx: mistToSui(vault.policy.maxPerTx),
          allowedActions: vault.policy.allowedActions,
          cooldownMs: vault.policy.cooldownMs,
          expiresAt: vault.policy.expiresAt,
          isExpired: Date.now() >= vault.policy.expiresAt,
        },
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vault not found";
    return NextResponse.json(
      { success: false, error: message },
      { status: 404 },
    );
  }
}
