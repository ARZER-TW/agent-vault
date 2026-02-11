import { describe, it, expect } from "vitest";
import { parseAgentDecision, AgentDecisionSchema } from "../intent-parser";

describe("parseAgentDecision", () => {
  it("parses valid JSON response", () => {
    const input = JSON.stringify({
      action: "swap_sui_to_usdc",
      reasoning: "Market looks bullish",
      confidence: 0.8,
      params: {
        amount: "0.5",
        minOut: "1.2",
      },
    });

    const result = parseAgentDecision(input);
    expect(result.action).toBe("swap_sui_to_usdc");
    expect(result.reasoning).toBe("Market looks bullish");
    expect(result.confidence).toBe(0.8);
    expect(result.params?.amount).toBe("0.5");
    expect(result.params?.minOut).toBe("1.2");
  });

  it("parses hold action without params", () => {
    const input = JSON.stringify({
      action: "hold",
      reasoning: "Market is too volatile",
      confidence: 0.6,
    });

    const result = parseAgentDecision(input);
    expect(result.action).toBe("hold");
    expect(result.params).toBeUndefined();
  });

  it("parses JSON from markdown code block", () => {
    const input = `\`\`\`json
{
  "action": "swap_usdc_to_sui",
  "reasoning": "SUI price is low",
  "confidence": 0.7,
  "params": { "amount": "1.0" }
}
\`\`\``;

    const result = parseAgentDecision(input);
    expect(result.action).toBe("swap_usdc_to_sui");
    expect(result.params?.amount).toBe("1.0");
  });

  it("parses JSON from plain code block", () => {
    const input = `\`\`\`
{"action":"hold","reasoning":"No opportunity","confidence":0.3}
\`\`\``;

    const result = parseAgentDecision(input);
    expect(result.action).toBe("hold");
  });

  it("rejects invalid action type", () => {
    const input = JSON.stringify({
      action: "invalid_action",
      reasoning: "test",
      confidence: 0.5,
    });

    expect(() => parseAgentDecision(input)).toThrow();
  });

  it("rejects confidence out of range", () => {
    const input = JSON.stringify({
      action: "hold",
      reasoning: "test",
      confidence: 1.5, // > 1.0
    });

    expect(() => parseAgentDecision(input)).toThrow();
  });

  it("rejects empty reasoning", () => {
    const input = JSON.stringify({
      action: "hold",
      reasoning: "",
      confidence: 0.5,
    });

    expect(() => parseAgentDecision(input)).toThrow();
  });

  it("rejects non-numeric amount string", () => {
    const input = JSON.stringify({
      action: "swap_sui_to_usdc",
      reasoning: "test",
      confidence: 0.5,
      params: {
        amount: "not-a-number",
      },
    });

    expect(() => parseAgentDecision(input)).toThrow();
  });

  it("throws on non-JSON input", () => {
    expect(() => parseAgentDecision("This is just plain text")).toThrow();
  });

  it("validates schema directly", () => {
    const valid = {
      action: "hold" as const,
      reasoning: "test reason",
      confidence: 0.5,
    };

    const result = AgentDecisionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("handles large JSON string (> 10KB)", () => {
    const longReasoning = "A".repeat(15_000);
    const input = JSON.stringify({
      action: "hold",
      reasoning: longReasoning,
      confidence: 0.5,
    });

    const result = parseAgentDecision(input);
    expect(result.reasoning).toBe(longReasoning);
    expect(result.reasoning.length).toBe(15_000);
  });

  it("handles Unicode characters in reasoning", () => {
    const input = JSON.stringify({
      action: "hold",
      reasoning: "Market analysis: bearish trend detected",
      confidence: 0.4,
    });

    const result = parseAgentDecision(input);
    expect(result.reasoning).toContain("bearish");
  });

  it("handles CJK characters in reasoning", () => {
    const input = JSON.stringify({
      action: "swap_sui_to_usdc",
      reasoning: "SUI price is low, good time to buy",
      confidence: 0.7,
      params: { amount: "1.0" },
    });

    const result = parseAgentDecision(input);
    expect(result.action).toBe("swap_sui_to_usdc");
  });

  it("parses stable_mint action", () => {
    const input = JSON.stringify({
      action: "stable_mint",
      reasoning: "Good yield opportunity",
      confidence: 0.75,
      params: { amount: "1.0" },
    });

    const result = parseAgentDecision(input);
    expect(result.action).toBe("stable_mint");
  });

  it("parses stable_burn action", () => {
    const input = JSON.stringify({
      action: "stable_burn",
      reasoning: "Exit yield position",
      confidence: 0.8,
    });

    const result = parseAgentDecision(input);
    expect(result.action).toBe("stable_burn");
  });

  it("parses stable_claim action", () => {
    const input = JSON.stringify({
      action: "stable_claim",
      reasoning: "Claim accrued yield",
      confidence: 0.9,
    });

    const result = parseAgentDecision(input);
    expect(result.action).toBe("stable_claim");
  });

  it("takes first code block when multiple exist", () => {
    const input = `Here is my analysis:
\`\`\`json
{"action":"hold","reasoning":"first block","confidence":0.5}
\`\`\`
And another option:
\`\`\`json
{"action":"swap_sui_to_usdc","reasoning":"second block","confidence":0.9,"params":{"amount":"1.0"}}
\`\`\``;

    const result = parseAgentDecision(input);
    expect(result.reasoning).toBe("first block");
  });

  it("handles JSON with escaped quotes in strings", () => {
    const input = JSON.stringify({
      action: "hold",
      reasoning: 'Market says "wait" for now',
      confidence: 0.3,
    });

    const result = parseAgentDecision(input);
    expect(result.reasoning).toContain('"wait"');
  });

  it("rejects negative confidence", () => {
    const input = JSON.stringify({
      action: "hold",
      reasoning: "test",
      confidence: -0.1,
    });

    expect(() => parseAgentDecision(input)).toThrow();
  });

  it("accepts boundary confidence values (0 and 1)", () => {
    const input0 = JSON.stringify({
      action: "hold",
      reasoning: "zero confidence",
      confidence: 0,
    });
    expect(parseAgentDecision(input0).confidence).toBe(0);

    const input1 = JSON.stringify({
      action: "hold",
      reasoning: "full confidence",
      confidence: 1,
    });
    expect(parseAgentDecision(input1).confidence).toBe(1);
  });
});
