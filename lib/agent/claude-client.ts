import Anthropic from "@anthropic-ai/sdk";
import type { VaultData } from "@/lib/vault/types";
import type { OrderBookSnapshot } from "@/lib/sui/market";
import { mistToSui } from "@/lib/constants";
import { parseAgentDecision, type AgentDecision } from "./intent-parser";

const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are an AI trading agent managing a Sui blockchain vault.
Your job is to analyze market conditions and make trading decisions within your policy constraints.

You MUST respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "action": "swap_sui_to_usdc" | "swap_usdc_to_sui" | "hold",
  "reasoning": "Brief explanation of your decision",
  "confidence": 0.0 to 1.0,
  "params": {
    "amount": "amount in SUI as string (e.g. '0.5')",
    "minOut": "minimum output amount as string (optional)"
  }
}

Rules:
- Only use "swap_sui_to_usdc" or "swap_usdc_to_sui" if you see a clear opportunity
- Use "hold" if market conditions are unclear or unfavorable
- Never exceed the vault's remaining budget or per-tx limit
- Consider the cooldown period between transactions
- Be conservative with amounts - start small`;

function buildUserPrompt(params: {
  vault: VaultData;
  orderBook: OrderBookSnapshot;
}): string {
  const { vault, orderBook } = params;
  const remainingBudget = vault.policy.maxBudget - vault.totalSpent;

  return `Current Vault State:
- Balance: ${mistToSui(vault.balance)} SUI
- Remaining Budget: ${mistToSui(remainingBudget)} SUI
- Max Per TX: ${mistToSui(vault.policy.maxPerTx)} SUI
- Total Transactions: ${vault.txCount}
- Policy Expires: ${new Date(vault.policy.expiresAt).toISOString()}

Market Data (SUI/DBUSDC):
- Mid Price: ${orderBook.midPrice}
- Best Bid: ${orderBook.bidPrices[0] ?? "N/A"} (qty: ${orderBook.bidQuantities[0] ?? "N/A"})
- Best Ask: ${orderBook.askPrices[0] ?? "N/A"} (qty: ${orderBook.askQuantities[0] ?? "N/A"})
- Bid Depth (top 5): ${orderBook.bidPrices.slice(0, 5).map((p, i) => `${p}@${orderBook.bidQuantities[i]}`).join(", ")}
- Ask Depth (top 5): ${orderBook.askPrices.slice(0, 5).map((p, i) => `${p}@${orderBook.askQuantities[i]}`).join(", ")}

What trading action should I take?`;
}

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Ask Claude for a trading decision based on vault state and market data.
 */
export async function getAgentDecision(params: {
  vault: VaultData;
  orderBook: OrderBookSnapshot;
}): Promise<AgentDecision> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(params),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  return parseAgentDecision(textBlock.text);
}
