"use client";

import { useState, useCallback } from "react";
import type { VaultData } from "@/lib/vault/types";

type TestType =
  | "exceed_budget"
  | "break_cooldown"
  | "exceed_per_tx"
  | "unauthorized_agent"
  | "expired_policy";

interface TestResult {
  testType: string;
  testName: string;
  description: string;
  attempted: Record<string, string | number>;
  blocked: boolean;
  reason: string;
}

interface TestState {
  status: "idle" | "running" | "done";
  result: TestResult | null;
  error: string | null;
}

const TEST_CONFIGS: {
  type: TestType;
  label: string;
  shortDesc: string;
  icon: string;
}[] = [
  {
    type: "exceed_budget",
    label: "Budget Overflow",
    shortDesc: "Exceed remaining budget",
    icon: "B",
  },
  {
    type: "exceed_per_tx",
    label: "Per-TX Breach",
    shortDesc: "Exceed per-transaction limit",
    icon: "T",
  },
  {
    type: "break_cooldown",
    label: "Cooldown Bypass",
    shortDesc: "Trade during cooldown period",
    icon: "C",
  },
  {
    type: "unauthorized_agent",
    label: "Unauthorized Agent",
    shortDesc: "Use non-authorized AgentCap",
    icon: "A",
  },
  {
    type: "expired_policy",
    label: "Expired Policy",
    shortDesc: "Trade after policy expiry",
    icon: "E",
  },
];

interface GuardrailStressTestProps {
  vault: VaultData;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

export function GuardrailStressTest({ vault, addToast }: GuardrailStressTestProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tests, setTests] = useState<Record<TestType, TestState>>({
    exceed_budget: { status: "idle", result: null, error: null },
    break_cooldown: { status: "idle", result: null, error: null },
    exceed_per_tx: { status: "idle", result: null, error: null },
    unauthorized_agent: { status: "idle", result: null, error: null },
    expired_policy: { status: "idle", result: null, error: null },
  });
  const [isRunningAll, setIsRunningAll] = useState(false);

  const runSingleTest = useCallback(async (testType: TestType) => {
    setTests((prev) => ({
      ...prev,
      [testType]: { status: "running", result: null, error: null },
    }));

    try {
      const response = await fetch("/api/agent/policy-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: vault.id,
          testType,
        }),
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Test failed");
      }

      setTests((prev) => ({
        ...prev,
        [testType]: { status: "done", result: json.data, error: null },
      }));

      return json.data as TestResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test failed";
      setTests((prev) => ({
        ...prev,
        [testType]: { status: "done", result: null, error: message },
      }));
      return null;
    }
  }, [vault.id]);

  const runAllTests = useCallback(async () => {
    setIsRunningAll(true);

    // Reset all tests
    const resetState: Record<TestType, TestState> = {
      exceed_budget: { status: "idle", result: null, error: null },
      break_cooldown: { status: "idle", result: null, error: null },
      exceed_per_tx: { status: "idle", result: null, error: null },
      unauthorized_agent: { status: "idle", result: null, error: null },
      expired_policy: { status: "idle", result: null, error: null },
    };
    setTests(resetState);

    // Run tests sequentially with small delay for visual effect
    let blocked = 0;
    let total = 0;

    for (const config of TEST_CONFIGS) {
      const result = await runSingleTest(config.type);
      total++;
      if (result?.blocked) blocked++;
      // Small delay for visual stagger
      await new Promise((r) => setTimeout(r, 300));
    }

    const allBlocked = blocked === total;
    addToast(
      allBlocked ? "success" : "error",
      allBlocked
        ? `All ${total} guardrail tests passed - policy is secure`
        : `${blocked}/${total} tests blocked - some guardrails may be misconfigured`,
    );

    setIsRunningAll(false);
  }, [runSingleTest, addToast]);

  const completedCount = Object.values(tests).filter((t) => t.status === "done").length;
  const blockedCount = Object.values(tests).filter((t) => t.result?.blocked).length;

  return (
    <div className="glass-card p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider mb-1">
            Guardrail Stress Test
          </h2>
          <p className="text-[11px] text-gray-600 font-mono">
            Verify policy enforcement with adversarial scenarios
          </p>
        </div>
        <div className="flex items-center gap-3">
          {completedCount > 0 && (
            <span className="text-xs font-mono text-gray-500">
              {blockedCount}/{completedCount} blocked
            </span>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`relative w-10 h-5 rounded-full transition-colors ${isOpen ? "bg-accent" : "bg-elevated"}`}
            role="switch"
            aria-checked={isOpen}
            aria-label="Toggle guardrail stress test panel"
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
              style={{ left: isOpen ? "22px" : "2px" }}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-4">
          {/* Run All Button */}
          <button
            onClick={runAllTests}
            disabled={isRunningAll}
            className="w-full px-4 py-3 rounded-xl text-sm font-mono font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            aria-label="Run all guardrail stress tests"
          >
            {isRunningAll ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                Running adversarial tests...
              </span>
            ) : (
              "Run All Stress Tests"
            )}
          </button>

          {/* Individual Tests */}
          <div className="space-y-2">
            {TEST_CONFIGS.map((config) => {
              const state = tests[config.type];
              return (
                <TestRow
                  key={config.type}
                  config={config}
                  state={state}
                  isRunningAll={isRunningAll}
                  onRun={() => runSingleTest(config.type)}
                />
              );
            })}
          </div>

          {/* Summary */}
          {completedCount === TEST_CONFIGS.length && (
            <div
              className={`p-4 rounded-xl border ${
                blockedCount === completedCount
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-2xl font-display font-bold ${
                    blockedCount === completedCount ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {blockedCount}/{completedCount}
                </span>
                <div>
                  <p
                    className={`text-sm font-medium ${
                      blockedCount === completedCount ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {blockedCount === completedCount
                      ? "All Guardrails Holding"
                      : "Guardrail Breach Detected"}
                  </p>
                  <p className="text-[11px] text-gray-500 font-mono">
                    {blockedCount === completedCount
                      ? "Smart contract policy enforcement is working correctly"
                      : "Some adversarial scenarios were not blocked"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TestRow({
  config,
  state,
  isRunningAll,
  onRun,
}: {
  config: (typeof TEST_CONFIGS)[number];
  state: TestState;
  isRunningAll: boolean;
  onRun: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-colors ${
        state.status === "done"
          ? state.result?.blocked
            ? "border-emerald-500/20 bg-emerald-500/5"
            : state.error
              ? "border-amber/20 bg-amber/5"
              : "border-red-500/20 bg-red-500/5"
          : "border-vault-border bg-void/30"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
            state.status === "done"
              ? state.result?.blocked
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
              : "bg-elevated text-gray-500"
          }`}
        >
          {state.status === "running" ? (
            <span className="w-3 h-3 border-2 border-gray-500/30 border-t-gray-400 rounded-full animate-spin" />
          ) : state.status === "done" ? (
            state.result?.blocked ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )
          ) : (
            config.icon
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{config.label}</p>
          <p className="text-[11px] text-gray-500 font-mono truncate">{config.shortDesc}</p>
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {state.status === "done" && (
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                state.result?.blocked
                  ? "bg-emerald-500/20 text-emerald-400"
                  : state.error
                    ? "bg-amber/20 text-amber"
                    : "bg-red-500/20 text-red-400"
              }`}
            >
              {state.result?.blocked ? "BLOCKED" : state.error ? "ERROR" : "PASSED"}
            </span>
          )}

          {state.status === "done" && state.result && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded hover:bg-white/5 transition-colors"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${config.label} test details`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

          {state.status !== "running" && !isRunningAll && (
            <button
              onClick={onRun}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-500 hover:text-white"
              aria-label={`Run ${config.label} test`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && state.result && (
        <div className="px-4 pb-3 border-t border-vault-border/50">
          <div className="pt-3 space-y-2">
            <p className="text-[11px] text-gray-400 font-mono">{state.result.description}</p>
            <div className="space-y-1">
              {Object.entries(state.result.attempted).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-600 font-mono">{key}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{String(val)}</span>
                </div>
              ))}
            </div>
            <div className="pt-1">
              <p className="text-[11px] font-mono text-gray-500">
                <span className="text-gray-600">Result: </span>
                {state.result.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {isExpanded && state.error && (
        <div className="px-4 pb-3 border-t border-vault-border/50">
          <p className="pt-3 text-[11px] text-amber font-mono">{state.error}</p>
        </div>
      )}
    </div>
  );
}
