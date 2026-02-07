"use client";

import { useState } from "react";
import type { VaultData, AgentCapData } from "@/lib/vault/types";
import { useVaultStore } from "@/lib/store/vault-store";
import { mistToSui } from "@/lib/constants";

interface VaultApiFields {
  balance: number;
  totalSpent: number;
  txCount: number;
}

interface DemoModePanelProps {
  vault: VaultData;
  activeAgentCap: AgentCapData | undefined;
  agentAddress: string | null;
  isRunning: boolean;
  onSetRunning: (running: boolean) => void;
  onVaultUpdate: (v: VaultApiFields) => void;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

export function DemoModePanel({
  vault,
  activeAgentCap,
  agentAddress,
  isRunning,
  onSetRunning,
  onVaultUpdate,
  addToast,
}: DemoModePanelProps) {
  const { addAgentLog } = useVaultStore();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoAmount, setDemoAmount] = useState("");

  async function handleDemoRun(forceAmount: number) {
    if (!activeAgentCap || !agentAddress) return;

    onSetRunning(true);
    try {
      const response = await fetch("/api/agent/demo-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: vault.id,
          agentCapId: activeAgentCap.id,
          ownerAddress: vault.owner,
          forceAmount,
        }),
      });

      const json = await response.json();
      if (!json.success) {
        const detail = json.details
          ? json.details.map((d: { path: string[]; message: string }) => `${d.path.join(".")}: ${d.message}`).join(", ")
          : "";
        throw new Error(detail || json.error || "Demo run failed");
      }

      addAgentLog(json.data);

      if (json.data.vault) {
        onVaultUpdate(json.data.vault);
      }

      if (json.data.policyCheck?.allowed && json.data.txDigest) {
        addToast("success", `Demo TX executed: ${json.data.txDigest}`);
      } else if (!json.data.policyCheck?.allowed) {
        addToast("info", `Policy blocked: ${json.data.policyCheck.reason}`);
      }
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Demo run failed");
    } finally {
      onSetRunning(false);
    }
  }

  return (
    <div className="mb-4 p-4 rounded-xl border border-vault-border bg-void/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            Demo Mode
          </span>
          <span className="text-[10px] font-mono text-gray-600">
            (skip AI, test policy directly)
          </span>
        </div>
        <button
          onClick={() => setIsDemoMode(!isDemoMode)}
          className={`relative w-10 h-5 rounded-full transition-colors ${isDemoMode ? "bg-accent" : "bg-elevated"}`}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ left: isDemoMode ? "22px" : "2px" }}
          />
        </button>
      </div>

      {isDemoMode && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={demoAmount}
              onChange={(e) => setDemoAmount(e.target.value)}
              placeholder="Amount in SUI"
              step="0.01"
              min="0"
              className="vault-input text-sm flex-1"
            />
            <button
              onClick={() => handleDemoRun(parseFloat(demoAmount || "0"))}
              disabled={isRunning || !demoAmount || parseFloat(demoAmount) <= 0 || !activeAgentCap}
              className="btn-primary text-sm"
            >
              {isRunning ? "Running..." : "Test"}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const overLimit = mistToSui(vault.policy.maxPerTx) * 2;
                setDemoAmount(String(overLimit));
                handleDemoRun(overLimit);
              }}
              disabled={isRunning || !activeAgentCap}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-mono bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              Test Over-Limit
            </button>
            <button
              onClick={() => {
                const normal = mistToSui(vault.policy.maxPerTx) * 0.5;
                setDemoAmount(String(normal));
                handleDemoRun(normal);
              }}
              disabled={isRunning || !activeAgentCap}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              Test Normal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
