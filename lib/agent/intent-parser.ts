import { z } from "zod";

/**
 * Schema for Claude's trading decision response.
 */
export const AgentDecisionSchema = z.object({
  action: z.enum(["swap_sui_to_usdc", "swap_usdc_to_sui", "hold"]),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
  params: z
    .object({
      amount: z.string().regex(/^\d+(\.\d+)?$/, "Must be a numeric string"),
      minOut: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    })
    .optional(),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

/**
 * Parse Claude's response text into a validated AgentDecision.
 * Handles both raw JSON and markdown-wrapped code blocks.
 */
export function parseAgentDecision(responseText: string): AgentDecision {
  const jsonStr = extractJson(responseText);
  const parsed = JSON.parse(jsonStr);
  return AgentDecisionSchema.parse(parsed);
}

/**
 * Extract JSON from response text.
 * Supports: raw JSON, ```json blocks, ``` blocks.
 */
function extractJson(text: string): string {
  const trimmed = text.trim();

  // Try raw JSON first
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  // Try markdown code block: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  throw new Error("Could not extract JSON from Claude response");
}
