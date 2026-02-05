import { NextRequest, NextResponse } from "next/server";
import { getVault } from "@/lib/vault/service";
import { mistToSui } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
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
