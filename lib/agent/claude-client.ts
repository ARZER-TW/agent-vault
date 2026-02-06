import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VaultData } from "@/lib/vault/types";
import type { OrderBookSnapshot } from "@/lib/sui/market";
import { mistToSui } from "@/lib/constants";
import { parseAgentDecision, type AgentDecision } from "./intent-parser";

type LLMProvider = "anthropic" | "openai" | "gemini";

const MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
};

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

/**
 * Detect which LLM provider to use based on available API keys.
 * Priority: OPENAI > GEMINI > ANTHROPIC (check in order, use first available).
 * Override with LLM_PROVIDER env var to force a specific provider.
 */
function detectProvider(): LLMProvider {
  const forced = process.env.LLM_PROVIDER as LLMProvider | undefined;
  if (forced && MODELS[forced]) return forced;

  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";

  throw new Error(
    "No LLM API key found. Set one of: OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY",
  );
}

// -- Provider-specific call functions --

async function callAnthropic(userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.anthropic,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Anthropic response");
  }
  return textBlock.text;
}

async function callOpenAI(userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: MODELS.openai,
    max_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No text content in OpenAI response");
  return text;
}

async function callGemini(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text) throw new Error("No text content in Gemini response");
  return text;
}

const PROVIDER_CALLERS: Record<LLMProvider, (prompt: string) => Promise<string>> = {
  anthropic: callAnthropic,
  openai: callOpenAI,
  gemini: callGemini,
};

/**
 * Get a trading decision from the configured LLM provider.
 * Auto-detects provider from env vars, or use LLM_PROVIDER to force one.
 */
export async function getAgentDecision(params: {
  vault: VaultData;
  orderBook: OrderBookSnapshot;
}): Promise<AgentDecision> {
  const provider = detectProvider();
  const caller = PROVIDER_CALLERS[provider];
  const userPrompt = buildUserPrompt(params);

  const rawText = await caller(userPrompt);
  return parseAgentDecision(rawText);
}
