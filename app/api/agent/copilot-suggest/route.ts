import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVault } from "@/lib/vault/service";
import { getOrderBook } from "@/lib/sui/market";
import { getAgentDecision } from "@/lib/agent/claude-client";
import { checkPolicy } from "@/lib/agent/policy-checker";
import { suiToMist, ACTION_SWAP, DEEPBOOK_POOL_KEY } from "@/lib/constants";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

const RequestSchema = z.object({
  vaultId: z.string().min(1),
  agentCapId: z.string().min(1),
  agentAddress: z.string().min(1),
  ownerAddress: z.string().min(1),
  strategy: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 15, windowMs: 60_000 });
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

    // Step 1: Fetch vault state
    const vault = await getVault(params.vaultId);

    // Step 2: Get market data
    const orderBook = await getOrderBook(params.agentAddress, DEEPBOOK_POOL_KEY);

    // Step 3: Ask LLM for decision
    let decision;
    try {
      decision = await getAgentDecision({
        vault,
        orderBook,
        strategy: params.strategy,
      });
    } catch (llmError) {
      const errorMsg = llmError instanceof Error ? llmError.message : String(llmError);
      return NextResponse.json({
        success: true,
        data: {
          decision: {
            action: "hold",
            reasoning: `[Fallback] LLM unavailable: ${errorMsg}`,
            confidence: 0,
            params: undefined,
          },
          policyCheck: { allowed: true, reason: "Hold fallback - no transaction needed" },
          market: {
            midPrice: orderBook.midPrice,
            timestamp: orderBook.timestamp,
            source: orderBook.source,
          },
          timestamp: Date.now(),
          error: { step: "llm_decision", error: errorMsg },
        },
      });
    }

    // Step 4: If hold or low confidence, return early with no policy check needed
    if (decision.action === "hold" || decision.confidence < 0.5) {
      return NextResponse.json({
        success: true,
        data: {
          decision: decision.confidence < 0.5 && decision.action !== "hold"
            ? {
                ...decision,
                action: "hold" as const,
                reasoning: `Low confidence (${(decision.confidence * 100).toFixed(0)}%), holding. Original: ${decision.reasoning}`,
              }
            : decision,
          policyCheck: { allowed: true, reason: "Hold action - no transaction needed" },
          market: {
            midPrice: orderBook.midPrice,
            timestamp: orderBook.timestamp,
            source: orderBook.source,
          },
          timestamp: Date.now(),
        },
      });
    }

    // Step 5: Parse amount and check policy
    const amountSui = parseFloat(decision.params?.amount ?? "0");
    if (amountSui <= 0) {
      return NextResponse.json({
        success: true,
        data: {
          decision,
          policyCheck: { allowed: true, reason: "No amount specified - treating as hold" },
          market: {
            midPrice: orderBook.midPrice,
            timestamp: orderBook.timestamp,
            source: orderBook.source,
          },
          timestamp: Date.now(),
        },
      });
    }

    const amountMist = suiToMist(amountSui);
    const policyCheck = checkPolicy({
      vault,
      amount: amountMist,
      actionType: ACTION_SWAP,
      nowMs: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: {
        decision,
        policyCheck,
        market: {
          midPrice: orderBook.midPrice,
          timestamp: orderBook.timestamp,
          source: orderBook.source,
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
