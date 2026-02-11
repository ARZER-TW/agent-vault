"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AgentActivityLog } from "@/components/agent/agent-activity-log";
import { ToastContainer, useToast } from "@/components/ui/toast";
import { StatCard } from "@/components/vault/stat-card";
import { PolicyRow } from "@/components/vault/policy-row";
import { BudgetBar } from "@/components/vault/budget-bar";
import { OwnerActions } from "@/components/vault/owner-actions";
import { DemoModePanel } from "@/components/vault/demo-mode-panel";
import { GuardrailStressTest } from "@/components/vault/guardrail-stress-test";
import { StrategyInput } from "@/components/vault/strategy-input";
import { AutoRunControls } from "@/components/vault/auto-run-controls";
import { OnChainAudit } from "@/components/vault/on-chain-audit";
import { useAuthStore } from "@/lib/store/auth-store";
import { useVaultStore } from "@/lib/store/vault-store";
import { getVault, getAgentCaps, getOwnerCaps } from "@/lib/vault/service";
import { mistToSui, ACTION_LABELS } from "@/lib/constants";
import type { VaultData, AgentCapData, OwnerCapData, VaultApiFields } from "@/lib/vault/types";

export default function VaultDetailPage() {
  const params = useParams();
  const vaultId = params.id as string;
  const { address, ephemeralKeypair, zkProof, maxEpoch } = useAuthStore();
  const { addAgentLog } = useVaultStore();
  const { toasts, addToast, dismissToast } = useToast();

  const [vault, setVault] = useState<VaultData | null>(null);
  const [agentCaps, setAgentCaps] = useState<AgentCapData[]>([]);
  const [ownerCap, setOwnerCap] = useState<OwnerCapData | null>(null);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [strategy, setStrategy] = useState("");
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  const canSignTx = address && ephemeralKeypair && zkProof && maxEpoch !== null;

  const refreshVault = useCallback(async () => {
    const vaultData = await getVault(vaultId);
    setVault(vaultData);
  }, [vaultId]);

  const refreshAgentCaps = useCallback(async (agentAddr: string) => {
    const caps = await getAgentCaps(agentAddr);
    const vaultCaps = caps.filter((cap) => cap.vaultId === vaultId);
    setAgentCaps(vaultCaps);
  }, [vaultId]);

  const handleVaultUpdate = useCallback((v: VaultApiFields) => {
    setVault((prev) =>
      prev
        ? {
            ...prev,
            balance: BigInt(Math.round(v.balance * 1e9)),
            totalSpent: BigInt(Math.round(v.totalSpent * 1e9)),
            txCount: v.txCount,
          }
        : prev,
    );
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const vaultData = await getVault(vaultId);
        setVault(vaultData);

        const agentRes = await fetch("/api/agent/address");
        const agentJson = await agentRes.json();
        const fetchedAgentAddress = agentJson.success ? agentJson.address : null;
        setAgentAddress(fetchedAgentAddress);

        if (fetchedAgentAddress) {
          const caps = await getAgentCaps(fetchedAgentAddress);
          const vaultCaps = caps.filter((cap) => cap.vaultId === vaultId);
          setAgentCaps(vaultCaps);
        }

        if (address) {
          const ownerCaps = await getOwnerCaps(address);
          const matchingCap = ownerCaps.find((cap) => cap.vaultId === vaultId);
          setOwnerCap(matchingCap ?? null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch vault";
        addToast("error", message);
      } finally {
        setIsLoading(false);
      }
    }

    if (vaultId) fetchData();
  }, [vaultId, address, addToast]);

  const activeAgentCap = agentCaps.find((cap) =>
    vault?.authorizedCaps.includes(cap.id),
  );

  const isOwner = address && vault && address === vault.owner;

  async function handleRunAgent() {
    if (!vault || !agentAddress || !activeAgentCap) return;

    setIsRunning(true);
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: vault.id,
          agentCapId: activeAgentCap.id,
          agentAddress,
          ownerAddress: vault.owner,
          strategy: strategy || undefined,
        }),
      });

      const json = await response.json();
      if (!json.success) {
        const detail = json.details
          ? json.details.map((d: { path: string[]; message: string }) => `${d.path.join(".")}: ${d.message}`).join(", ")
          : "";
        throw new Error(detail || json.error || "Agent run failed");
      }

      addAgentLog(json.data);

      if (json.data.vault) {
        handleVaultUpdate(json.data.vault);
      }

      if (json.data.policyCheck?.allowed && json.data.txDigest) {
        setAuditRefreshKey((k) => k + 1);
        addToast("success", `Agent executed. TX: ${json.data.txDigest}`);
      } else if (!json.data.policyCheck?.allowed) {
        addToast("info", `Policy blocked: ${json.data.policyCheck.reason}`);
      } else {
        addToast("info", "Agent decided to hold.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent run failed";
      addToast("error", message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="min-h-screen relative">
      <Header />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
                <p className="text-sm font-mono font-medium text-accent tracking-widest uppercase mb-2">
                  Vault Detail
                </p>
                <h1 className="font-display font-bold text-4xl text-white mb-2">
                  Vault Overview
                </h1>
                <p className="text-base font-mono text-gray-500">
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
                ringProgress={
                  vault.policy.maxBudget > 0n
                    ? Number(vault.balance * 100n / vault.policy.maxBudget) / 100
                    : 0
                }
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
                ringProgress={
                  vault.policy.maxBudget > 0n
                    ? Number((vault.policy.maxBudget - vault.totalSpent) * 100n / vault.policy.maxBudget) / 100
                    : 0
                }
              />
              <StatCard
                label="Transactions"
                value={String(vault.txCount)}
              />
            </div>

            {/* Budget usage bar */}
            <BudgetBar
              totalSpent={vault.totalSpent}
              maxBudget={vault.policy.maxBudget}
            />

            {/* Policy Details */}
            <div className="glass-card p-6 animate-fade-in-up">
              <h2 className="text-sm font-mono font-medium text-gray-500 uppercase tracking-wider mb-4">
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
                    ? vault.policy.allowedActions.map((a) => ACTION_LABELS[a] ?? `Action ${a}`).join(", ")
                    : "None"}
                />
                <PolicyRow
                  label="Authorized Agents"
                  value={String(vault.authorizedCaps.length)}
                />
              </div>
            </div>

            {/* Guardrail Stress Test */}
            <GuardrailStressTest vault={vault} addToast={addToast} />

            {/* Owner Actions */}
            {isOwner && ownerCap && canSignTx && (
              <OwnerActions
                vault={vault}
                ownerCap={ownerCap}
                activeAgentCap={activeAgentCap}
                agentAddress={agentAddress}
                senderAddress={address!}
                ephemeralKeypair={ephemeralKeypair!}
                zkProof={zkProof!}
                maxEpoch={maxEpoch!}
                onRefreshVault={refreshVault}
                onRefreshAgentCaps={refreshAgentCaps}
                addToast={addToast}
              />
            )}

            {/* Natural Language Strategy */}
            <StrategyInput strategy={strategy} onStrategyChange={setStrategy} />

            {/* Agent Controls */}
            <div className={`glass-card p-6 animate-fade-in-up${isRunning ? " agent-running-glow" : ""}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-mono font-medium text-gray-500 uppercase tracking-wider mb-2">
                    AI Agent Runtime
                  </h2>
                  {activeAgentCap ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-sm font-mono text-emerald-400">
                        AgentCap: {activeAgentCap.id.slice(0, 10)}...
                      </span>
                    </div>
                  ) : address ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber" />
                      <span className="text-sm text-amber">
                        No authorized AgentCap found
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                      <span className="text-sm text-gray-500">
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
                    !agentAddress ||
                    Date.now() >= vault.policy.expiresAt
                  }
                  className="btn-primary"
                  aria-label="Run one AI agent trading cycle"
                >
                  {isRunning ? (
                    <>
                      <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Run Agent Cycle
                    </>
                  )}
                </button>
              </div>

              {/* Auto-Run Controls */}
              <AutoRunControls
                vault={vault}
                activeAgentCap={activeAgentCap}
                agentAddress={agentAddress}
                strategy={strategy}
                isRunning={isRunning}
                onSetRunning={setIsRunning}
                onVaultUpdate={handleVaultUpdate}
                addToast={addToast}
              />

              {/* Demo Mode Panel */}
              <DemoModePanel
                vault={vault}
                activeAgentCap={activeAgentCap}
                agentAddress={agentAddress}
                isRunning={isRunning}
                onSetRunning={setIsRunning}
                onVaultUpdate={handleVaultUpdate}
                addToast={addToast}
              />

              <AgentActivityLog />
            </div>

            {/* On-Chain Audit Trail */}
            <OnChainAudit vaultId={vaultId} refreshKey={auditRefreshKey} />
          </div>
        )}
      </main>
    </div>
  );
}
