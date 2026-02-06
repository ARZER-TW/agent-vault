import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgentCycle } from "@/lib/agent/runtime";
import { mistToSui } from "@/lib/constants";

const RequestSchema = z.object({
  vaultId: z.string().min(1),
  agentCapId: z.string().min(1),
  agentAddress: z.string().min(1),
  ownerAddress: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = RequestSchema.parse(body);

    const result = await runAgentCycle(params);

    return NextResponse.json({
      success: true,
      data: {
        decision: result.decision,
        policyCheck: result.policyCheck,
        hasTransaction: result.transaction !== null,
        txDigest: result.txDigest,
        timestamp: Date.now(),
        vault: {
          id: result.vault.id,
          balance: mistToSui(result.vault.balance),
          totalSpent: mistToSui(result.vault.totalSpent),
          txCount: result.vault.txCount,
        },
        market: {
          midPrice: result.orderBook.midPrice,
          timestamp: result.orderBook.timestamp,
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
