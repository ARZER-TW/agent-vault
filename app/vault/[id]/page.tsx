"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AgentActivityLog } from "@/components/agent/agent-activity-log";
import { useAuthStore } from "@/lib/store/auth-store";
import { useVaultStore } from "@/lib/store/vault-store";
import { getVault, getAgentCaps } from "@/lib/vault/service";
import { mistToSui } from "@/lib/constants";
import type { VaultData, AgentCapData } from "@/lib/vault/types";

function StatCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="stat-card glass-card">
      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-xl font-display font-bold ${accent ? "text-accent" : "text-white"}`}>
        {value}
        {unit && (
          <span className="text-xs text-gray-500 ml-1 font-mono">{unit}</span>
        )}
      </p>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-vault-border last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-mono text-white">{value}</span>
    </div>
  );
}

export default function VaultDetailPage() {
  const params = useParams();
  const vaultId = params.id as string;
  const { address } = useAuthStore();
  const { addAgentLog } = useVaultStore();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [agentCaps, setAgentCaps] = useState<AgentCapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoAmount, setDemoAmount] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const vaultData = await getVault(vaultId);
        setVault(vaultData);

        if (address) {
          const caps = await getAgentCaps(address);
          const vaultCaps = caps.filter((cap) => cap.vaultId === vaultId);
          setAgentCaps(vaultCaps);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch vault";
        alert(message);
      } finally {
        setIsLoading(false);
      }
    }

    if (vaultId) fetchData();
  }, [vaultId, address]);

  const activeAgentCap = agentCaps.find((cap) =>
    vault?.authorizedCaps.includes(cap.id),
  );

  async function handleRunAgent() {
    if (!vault || !address) return;

    if (!activeAgentCap) {
      alert(
        "No authorized AgentCap found. The vault owner must mint an AgentCap for your address first.",
      );
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: vault.id,
          agentCapId: activeAgentCap.id,
          agentAddress: address,
          ownerAddress: vault.owner,
        }),
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Agent run failed");
      }

      addAgentLog(json.data);

      const updated = await getVault(vaultId);
      setVault(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Agent run failed";
      alert(message);
    } finally {
      setIsRunning(false);
    }
  }

  async function handleDemoRun(forceAmount: number) {
    if (!vault || !activeAgentCap) return;

    setIsRunning(true);
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
        throw new Error(json.error || "Demo run failed");
      }

      addAgentLog(json.data);

      const updated = await getVault(vaultId);
      setVault(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Demo run failed";
      alert(message);
    } finally {
      setIsRunning(false);
    }
  }

  const budgetSpentPct =
    vault && vault.policy.maxBudget > 0n
      ? Number((vault.totalSpent * 100n) / vault.policy.maxBudget)
      : 0;

  return (
    <div className="min-h-screen relative">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="glass-card p-16 text-center">
            <div className="w-8 h-8 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-gray-500">Loading vault...</p>
          </div>
        ) : !vault ? (
          <div className="glass-card p-16 text-center">
            <p className="text-gray-500">Vault not found.</p>
          </div>
        ) : (
          <div className="space-y-8 stagger-children">
            {/* Vault Header */}
            <div className="flex items-start justify-between animate-fade-in-up">
              <div>
                <p className="text-xs font-mono font-medium text-accent tracking-widest uppercase mb-2">
                  Vault Detail
                </p>
                <h1 className="font-display font-bold text-3xl text-white mb-2">
                  Vault Overview
                </h1>
                <p className="text-sm font-mono text-gray-500">
                  {vault.id}
                </p>
              </div>
              <span
                className={
                  Date.now() >= vault.policy.expiresAt
                    ? "badge-expired"
                    : "badge-active"
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    Date.now() >= vault.policy.expiresAt
                      ? "bg-red-400"
                      : "bg-emerald-400"
                  }`}
                />
                {Date.now() >= vault.policy.expiresAt ? "Expired" : "Active"}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
              <StatCard
                label="Balance"
                value={mistToSui(vault.balance).toFixed(4)}
                unit="SUI"
                accent
              />
              <StatCard
                label="Total Spent"
                value={mistToSui(vault.totalSpent).toFixed(4)}
                unit="SUI"
              />
              <StatCard
                label="Budget Left"
                value={mistToSui(vault.policy.maxBudget - vault.totalSpent).toFixed(4)}
                unit="SUI"
              />
              <StatCard
                label="Transactions"
                value={String(vault.txCount)}
              />
            </div>

            {/* Budget usage bar */}
            <div className="glass-card p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                  Budget Utilization
                </p>
                <span className={`text-sm font-mono font-bold ${budgetSpentPct > 80 ? "text-amber" : "text-accent"}`}>
                  {budgetSpentPct}%
                </span>
              </div>
              <div className="budget-bar">
                <div
                  className="budget-bar-fill"
                  style={{ width: `${Math.min(budgetSpentPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-mono text-gray-600">
                <span>0 SUI</span>
                <span>{mistToSui(vault.policy.maxBudget).toFixed(2)} SUI</span>
              </div>
            </div>

            {/* Policy Details */}
            <div className="glass-card p-6 animate-fade-in-up">
              <h2 className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider mb-4">
                Policy Configuration
              </h2>
              <div className="divide-y divide-vault-border">
                <PolicyRow
                  label="Max Budget"
                  value={`${mistToSui(vault.policy.maxBudget).toFixed(4)} SUI`}
                />
                <PolicyRow
                  label="Max Per TX"
                  value={`${mistToSui(vault.policy.maxPerTx).toFixed(4)} SUI`}
                />
                <PolicyRow
                  label="Cooldown"
                  value={`${vault.policy.cooldownMs / 1000}s`}
                />
                <PolicyRow
                  label="Expires"
                  value={new Date(vault.policy.expiresAt).toLocaleString()}
                />
                <PolicyRow
                  label="Allowed Actions"
                  value={vault.policy.allowedActions.length > 0
                    ? vault.policy.allowedActions.map((a) => a === 0 ? "Swap" : `Action ${a}`).join(", ")
                    : "None"}
                />
                <PolicyRow
                  label="Authorized Agents"
                  value={String(vault.authorizedCaps.length)}
                />
              </div>
            </div>

            {/* Agent Controls */}
            <div className="glass-card p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider mb-2">
                    AI Agent Runtime
                  </h2>
                  {activeAgentCap ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-mono text-emerald-400">
                        AgentCap: {activeAgentCap.id.slice(0, 10)}...
                      </span>
                    </div>
                  ) : address ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber" />
                      <span className="text-xs text-amber">
                        No authorized AgentCap found
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                      <span className="text-xs text-gray-500">
                        Login to run the agent
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRunAgent}
                  disabled={
                    isRunning ||
                    !activeAgentCap ||
                    Date.now() >= vault.policy.expiresAt
                  }
                  className="btn-primary"
                >
                  {isRunning ? (
                    <>
                      <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Run Agent Cycle
                    </>
                  )}
                </button>
              </div>
              {/* Demo Mode Panel */}
              <div className="mb-4 p-4 rounded-xl border border-vault-border bg-void/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                      Demo Mode
                    </span>
                    <span className="text-[10px] font-mono text-gray-600">
                      (skip Claude, test policy directly)
                    </span>
                  </div>
                  <button
                    onClick={() => setIsDemoMode(!isDemoMode)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${isDemoMode ? "bg-accent" : "bg-elevated"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isDemoMode ? "left-5.5 translate-x-0" : "left-0.5"}`} style={{ left: isDemoMode ? "22px" : "2px" }} />
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
                          const overLimit = vault ? mistToSui(vault.policy.maxPerTx) * 2 : 5;
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
                          const normal = vault ? mistToSui(vault.policy.maxPerTx) * 0.5 : 0.1;
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

              <AgentActivityLog />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
