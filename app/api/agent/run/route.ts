import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgentCycle } from "@/lib/agent/runtime";
import { mistToSui } from "@/lib/constants";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

const RequestSchema = z.object({
  vaultId: z.string().min(1),
  agentCapId: z.string().min(1),
  agentAddress: z.string().min(1),
  ownerAddress: z.string().min(1),
  strategy: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 10, windowMs: 60_000 });
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

    const result = await runAgentCycle(params);

    // result.vault is already the post-TX updated vault from runtime
    const vault = result.vault;

    return NextResponse.json({
      success: true,
      data: {
        decision: result.decision,
        policyCheck: result.policyCheck,
        hasTransaction: result.transaction !== null,
        txDigest: result.txDigest,
        timestamp: Date.now(),
        vault: {
          id: vault.id,
          balance: mistToSui(vault.balance),
          totalSpent: mistToSui(vault.totalSpent),
          txCount: vault.txCount,
        },
        market: {
          midPrice: result.orderBook.midPrice,
          timestamp: result.orderBook.timestamp,
          source: result.orderBook.source,
        },
        ...(result.error ? { error: result.error } : {}),
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
