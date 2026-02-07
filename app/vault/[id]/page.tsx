"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AgentActivityLog } from "@/components/agent/agent-activity-log";
import { useAuthStore } from "@/lib/store/auth-store";
import { useVaultStore } from "@/lib/store/vault-store";
import { getVault, getAgentCaps, getOwnerCaps } from "@/lib/vault/service";
import {
  buildCreateAgentCap,
  buildRevokeAgentCap,
  buildWithdrawAll,
  buildDepositFromGas,
} from "@/lib/vault/ptb-builder";
import { executeDirectZkLoginTransaction } from "@/lib/auth/sponsored-tx";
import { mistToSui, suiToMist } from "@/lib/constants";
import type { VaultData, AgentCapData, OwnerCapData } from "@/lib/vault/types";

// -- Toast Notification --

interface ToastMessage {
  id: number;
  type: "success" | "error" | "info";
  text: string;
}

let toastIdCounter = 0;

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const styles = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    error: "border-red-500/30 bg-red-500/10 text-red-400",
    info: "border-accent/30 bg-accent/10 text-accent",
  };

  const icons = {
    success: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    info: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${styles[toast.type]} animate-fade-in-up`}
    >
      <span className="shrink-0 mt-0.5">{icons[toast.type]}</span>
      <p className="text-sm font-mono leading-relaxed break-all">{toast.text}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 ml-auto opacity-50 hover:opacity-100 transition-opacity"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// -- Sub-components --

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

// -- Main Page --

export default function VaultDetailPage() {
  const params = useParams();
  const vaultId = params.id as string;
  const { address, ephemeralKeypair, zkProof, maxEpoch } = useAuthStore();
  const { addAgentLog } = useVaultStore();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [agentCaps, setAgentCaps] = useState<AgentCapData[]>([]);
  const [ownerCap, setOwnerCap] = useState<OwnerCapData | null>(null);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoAmount, setDemoAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastMessage["type"], text: string) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, type, text }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const canSignTx = address && ephemeralKeypair && zkProof && maxEpoch !== null;

  async function refreshVault() {
    const vaultData = await getVault(vaultId);
    setVault(vaultData);
    return vaultData;
  }

  async function refreshAgentCaps(agentAddr: string) {
    const caps = await getAgentCaps(agentAddr);
    const vaultCaps = caps.filter((cap) => cap.vaultId === vaultId);
    setAgentCaps(vaultCaps);
  }

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

  // -- Owner Actions --

  async function handleMintAgentCap() {
    if (!vault || !address || !ownerCap || !agentAddress || !canSignTx) return;

    setIsMinting(true);
    try {
      const tx = buildCreateAgentCap({
        vaultId: vault.id,
        ownerCapId: ownerCap.id,
        agentAddress,
      });

      const digest = await executeDirectZkLoginTransaction({
        transaction: tx,
        senderAddress: address,
        ephemeralKeypair: ephemeralKeypair!,
        zkProof: zkProof!,
        maxEpoch: maxEpoch!,
      });

      addToast("success", `AgentCap minted. TX: ${digest}`);
      await refreshVault();
      await refreshAgentCaps(agentAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mint AgentCap";
      addToast("error", message);
    } finally {
      setIsMinting(false);
    }
  }

  async function handleDeposit() {
    if (!vault || !address || !ownerCap || !canSignTx) return;
    const amountSui = parseFloat(depositAmount);
    if (!amountSui || amountSui <= 0) {
      addToast("error", "Please enter a valid deposit amount.");
      return;
    }

    setIsDepositing(true);
    try {
      const tx = buildDepositFromGas({
        vaultId: vault.id,
        ownerCapId: ownerCap.id,
        amount: suiToMist(amountSui),
      });

      const digest = await executeDirectZkLoginTransaction({
        transaction: tx,
        senderAddress: address,
        ephemeralKeypair: ephemeralKeypair!,
        zkProof: zkProof!,
        maxEpoch: maxEpoch!,
      });

      addToast("success", `Deposited ${amountSui} SUI. TX: ${digest}`);
      setDepositAmount("");
      setShowDepositForm(false);
      await refreshVault();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deposit failed";
      addToast("error", message);
    } finally {
      setIsDepositing(false);
    }
  }

  async function handleWithdrawAll() {
    if (!vault || !address || !ownerCap || !canSignTx) return;
    if (vault.balance <= 0n) {
      addToast("info", "Vault balance is zero.");
      return;
    }

    setIsWithdrawing(true);
    try {
      const tx = buildWithdrawAll({
        vaultId: vault.id,
        ownerCapId: ownerCap.id,
        recipientAddress: address,
      });

      const digest = await executeDirectZkLoginTransaction({
        transaction: tx,
        senderAddress: address,
        ephemeralKeypair: ephemeralKeypair!,
        zkProof: zkProof!,
        maxEpoch: maxEpoch!,
      });

      addToast("success", `Withdrawn all funds. TX: ${digest}`);
      await refreshVault();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Withdrawal failed";
      addToast("error", message);
    } finally {
      setIsWithdrawing(false);
    }
  }

  async function handleRevokeAgent() {
    if (!vault || !address || !ownerCap || !activeAgentCap || !agentAddress || !canSignTx) return;

    setIsRevoking(true);
    try {
      const tx = buildRevokeAgentCap({
        vaultId: vault.id,
        ownerCapId: ownerCap.id,
        capId: activeAgentCap.id,
      });

      const digest = await executeDirectZkLoginTransaction({
        transaction: tx,
        senderAddress: address,
        ephemeralKeypair: ephemeralKeypair!,
        zkProof: zkProof!,
        maxEpoch: maxEpoch!,
      });

      addToast("success", `Agent revoked. TX: ${digest}`);
      await refreshVault();
      await refreshAgentCaps(agentAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Revoke failed";
      addToast("error", message);
    } finally {
      setIsRevoking(false);
    }
  }

  // -- Agent Actions --

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
        }),
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Agent run failed");
      }

      addAgentLog(json.data);

      // Use the vault data returned by the API (already post-TX confirmed)
      if (json.data.vault) {
        const v = json.data.vault;
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
      }

      if (json.data.policyCheck?.allowed && json.data.txDigest) {
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

  async function handleDemoRun(forceAmount: number) {
    if (!vault || !activeAgentCap || !agentAddress) return;

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

      // Update vault from API response
      if (json.data.vault) {
        const v = json.data.vault;
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
      }

      if (json.data.policyCheck?.allowed && json.data.txDigest) {
        addToast("success", `Demo TX executed: ${json.data.txDigest}`);
      } else if (!json.data.policyCheck?.allowed) {
        addToast("info", `Policy blocked: ${json.data.policyCheck.reason}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Demo run failed";
      addToast("error", message);
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

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 w-96 space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </div>

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

            {/* Owner Actions */}
            {isOwner && ownerCap && (
              <div className="glass-card p-6 animate-fade-in-up">
                <h2 className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider mb-4">
                  Owner Actions
                </h2>
                <div className="flex flex-wrap gap-3">
                  {/* Deposit */}
                  <button
                    onClick={() => setShowDepositForm(!showDepositForm)}
                    className="px-4 py-2 rounded-lg text-sm font-mono bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                  >
                    Deposit SUI
                  </button>

                  {/* Withdraw All */}
                  <button
                    onClick={handleWithdrawAll}
                    disabled={isWithdrawing || vault.balance <= 0n}
                    className="px-4 py-2 rounded-lg text-sm font-mono bg-amber/10 text-amber border border-amber/20 hover:bg-amber/20 transition-colors disabled:opacity-50"
                  >
                    {isWithdrawing ? "Withdrawing..." : "Withdraw All"}
                  </button>

                  {/* Revoke Agent */}
                  {activeAgentCap && (
                    <button
                      onClick={handleRevokeAgent}
                      disabled={isRevoking}
                      className="px-4 py-2 rounded-lg text-sm font-mono bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {isRevoking ? "Revoking..." : "Revoke Agent"}
                    </button>
                  )}
                </div>

                {/* Deposit Form */}
                {showDepositForm && (
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount in SUI"
                      step="0.01"
                      min="0.01"
                      className="vault-input text-sm flex-1"
                    />
                    <button
                      onClick={handleDeposit}
                      disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
                      className="btn-primary text-sm"
                    >
                      {isDepositing ? "Depositing..." : "Confirm"}
                    </button>
                  </div>
                )}
              </div>
            )}

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

              {/* Mint AgentCap - shown when owner has no authorized cap yet */}
              {isOwner && !activeAgentCap && agentAddress && ownerCap && (
                <div className="mb-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white mb-1">
                        Authorize AI Agent
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono">
                        Agent: {agentAddress.slice(0, 10)}...{agentAddress.slice(-6)}
                      </p>
                    </div>
                    <button
                      onClick={handleMintAgentCap}
                      disabled={isMinting}
                      className="btn-primary text-sm"
                    >
                      {isMinting ? (
                        <>
                          <span className="w-3 h-3 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                          Minting...
                        </>
                      ) : (
                        "Mint AgentCap"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Demo Mode Panel */}
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
