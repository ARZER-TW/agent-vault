import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VaultData } from "@/lib/vault/types";
import type { OrderBookSnapshot } from "@/lib/sui/market";
import { mistToSui, ACTION_LABELS } from "@/lib/constants";
import { STABLELAYER_AVAILABLE } from "@/lib/sui/stablelayer";
import { parseAgentDecision, type AgentDecision } from "./intent-parser";

type LLMProvider = "anthropic" | "openai" | "gemini";

const LLM_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

const MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
};

const SYSTEM_PROMPT = `You are an AI trading agent managing a Sui blockchain vault.
Your job is to analyze market conditions and make trading decisions within your policy constraints.

You MUST respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "action": "swap_sui_to_usdc" | "swap_usdc_to_sui" | "stable_mint" | "stable_burn" | "stable_claim" | "hold",
  "reasoning": "Brief explanation of your decision",
  "confidence": 0.0 to 1.0,
  "params": {
    "amount": "amount in SUI as string (e.g. '0.5') - required for swap and stable_mint actions",
    "minOut": "minimum output amount as string (optional)"
  }
}

Available Actions:
- "swap_sui_to_usdc": Withdraw SUI from vault, swap to USDC via Cetus DEX Aggregator, send USDC to owner
- "swap_usdc_to_sui": Withdraw SUI from vault, send directly to owner
- "stable_mint": Withdraw SUI from vault, swap to USDC via Cetus, then mint LakeUSDC stablecoin via Stablelayer for yield
- "stable_burn": Burn owner's LakeUSDC stablecoins back to USDC (no vault withdrawal, set amount to "0")
- "stable_claim": Claim accrued yield from Stablelayer position (no vault withdrawal, set amount to "0")
- "hold": Do nothing this cycle

Rules:
- Only execute trades when you see a clear opportunity
- Use "hold" if market conditions are unclear or unfavorable
- Never exceed the vault's remaining budget or per-tx limit
- Position sizing: never trade more than 30% of the remaining budget in a single transaction
- Consider the cooldown period between transactions
- Set confidence below 0.5 only when you want to signal "hold" (the system auto-holds below 50%)
- Be conservative with amounts - start small
- stable_mint is useful when you want to earn yield on USDC via Stablelayer's yield protocol
- Only use stable_burn/stable_claim when the owner has existing Stablelayer positions
- IMPORTANT: Only use actions that are listed in the Allowed Actions for this vault`;

function buildSystemPrompt(strategy?: string): string {
  if (!strategy || strategy.trim().length === 0) {
    return SYSTEM_PROMPT;
  }
  return `${SYSTEM_PROMPT}

IMPORTANT - User Strategy Directive:
The vault owner has specified the following trading strategy. Follow it as closely as possible while still respecting all policy constraints:
---
${strategy.trim().slice(0, 500)}
---`;
}

function buildUserPrompt(params: {
  vault: VaultData;
  orderBook: OrderBookSnapshot;
}): string {
  const { vault, orderBook } = params;
  const remainingBudget = vault.policy.maxBudget - vault.totalSpent;

  const maxPositionSize = mistToSui(remainingBudget) * 0.3;
  const effectiveMax = Math.min(maxPositionSize, mistToSui(vault.policy.maxPerTx));

  const allowedActionLabels = vault.policy.allowedActions
    .map((a) => ACTION_LABELS[a] ?? `Action ${a}`)
    .join(", ");

  return `Current Vault State:
- Balance: ${mistToSui(vault.balance)} SUI
- Remaining Budget: ${mistToSui(remainingBudget)} SUI (of ${mistToSui(vault.policy.maxBudget)} total)
- Max Per TX (policy): ${mistToSui(vault.policy.maxPerTx)} SUI
- Suggested Max Trade: ${effectiveMax.toFixed(4)} SUI (30% of remaining budget or per-tx limit, whichever is smaller)
- Total Transactions: ${vault.txCount}
- Policy Expires: ${new Date(vault.policy.expiresAt).toISOString()}
- Allowed Actions: ${allowedActionLabels}

Market Data (SUI/USDC via Cetus Aggregator):
- Mid Price: ${orderBook.midPrice}
- Best Bid: ${orderBook.bidPrices[0] ?? "N/A"} (qty: ${orderBook.bidQuantities[0] ?? "N/A"})
- Best Ask: ${orderBook.askPrices[0] ?? "N/A"} (qty: ${orderBook.askQuantities[0] ?? "N/A"})
- Data Source: ${orderBook.source}
${STABLELAYER_AVAILABLE ? "- Stablelayer: Available (LakeUSDC yield protocol)" : "- Stablelayer: Not available on current network"}

What trading action should I take? If confidence is below 50%, choose "hold".`;
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

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.anthropic,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Anthropic response");
  }
  return textBlock.text;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: MODELS.openai,
    max_tokens: 512,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No text content in OpenAI response");
  return text;
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text) throw new Error("No text content in Gemini response");
  return text;
}

const PROVIDER_CALLERS: Record<LLMProvider, (systemPrompt: string, userPrompt: string) => Promise<string>> = {
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
  strategy?: string;
}): Promise<AgentDecision> {
  const provider = detectProvider();
  const caller = PROVIDER_CALLERS[provider];
  const systemPrompt = buildSystemPrompt(params.strategy);
  const userPrompt = buildUserPrompt(params);

  const rawText = await withTimeout(
    caller(systemPrompt, userPrompt),
    LLM_TIMEOUT_MS,
    `LLM call (${provider})`,
  );
  return parseAgentDecision(rawText);
}
