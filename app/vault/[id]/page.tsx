"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AgentActivityLog } from "@/components/agent/agent-activity-log";
import { useAuthStore } from "@/lib/store/auth-store";
import { useVaultStore } from "@/lib/store/vault-store";
import { getVault } from "@/lib/vault/service";
import { runAgentCycle } from "@/lib/agent/runtime";
import { mistToSui } from "@/lib/constants";
import type { VaultData } from "@/lib/vault/types";

export default function VaultDetailPage() {
  const params = useParams();
  const vaultId = params.id as string;
  const { address } = useAuthStore();
  const { addAgentLog } = useVaultStore();
  const [vault, setVault] = useState<VaultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    async function fetchVault() {
      try {
        const data = await getVault(vaultId);
        setVault(data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch vault";
        alert(message);
      } finally {
        setIsLoading(false);
      }
    }

    if (vaultId) fetchVault();
  }, [vaultId]);

  async function handleRunAgent() {
    if (!vault || !address) return;

    setIsRunning(true);
    try {
      // For demo, agentCapId and agentAddress would come from the user's agent setup
      const result = await runAgentCycle({
        vaultId: vault.id,
        agentCapId: "0x_agent_cap_placeholder",
        agentAddress: address,
        ownerAddress: vault.owner,
      });
      addAgentLog(result);

      // Refresh vault data
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="text-center py-16 text-gray-500">
            Loading vault...
          </div>
        ) : !vault ? (
          <div className="text-center py-16 text-gray-500">
            Vault not found.
          </div>
        ) : (
          <div className="space-y-8">
            {/* Vault Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">Vault Details</h1>
                <p className="text-sm font-mono text-gray-500">{vault.id}</p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  Date.now() >= vault.policy.expiresAt
                    ? "bg-red-900/30 text-red-400"
                    : "bg-green-900/30 text-green-400"
                }`}
              >
                {Date.now() >= vault.policy.expiresAt ? "Expired" : "Active"}
              </span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Balance"
                value={`${mistToSui(vault.balance).toFixed(4)} SUI`}
              />
              <StatCard
                label="Total Spent"
                value={`${mistToSui(vault.totalSpent).toFixed(4)} SUI`}
              />
              <StatCard
                label="Remaining Budget"
                value={`${mistToSui(vault.policy.maxBudget - vault.totalSpent).toFixed(4)} SUI`}
              />
              <StatCard
                label="Transactions"
                value={String(vault.txCount)}
              />
            </div>

            {/* Policy Details */}
            <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
              <h2 className="text-sm font-bold text-gray-300 mb-4">
                Policy Configuration
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Max Budget</p>
                  <p className="text-white">
                    {mistToSui(vault.policy.maxBudget).toFixed(4)} SUI
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Max Per TX</p>
                  <p className="text-white">
                    {mistToSui(vault.policy.maxPerTx).toFixed(4)} SUI
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Cooldown</p>
                  <p className="text-white">
                    {vault.policy.cooldownMs / 1000}s
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Expires</p>
                  <p className="text-white">
                    {new Date(vault.policy.expiresAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Allowed Actions</p>
                  <p className="text-white">
                    {vault.policy.allowedActions.join(", ") || "None"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Authorized Agents</p>
                  <p className="text-white">{vault.authorizedCaps.length}</p>
                </div>
              </div>
            </div>

            {/* Agent Controls */}
            <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-300">
                  AI Agent
                </h2>
                <button
                  onClick={handleRunAgent}
                  disabled={isRunning || Date.now() >= vault.policy.expiresAt}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isRunning ? "Running..." : "Run Agent Cycle"}
                </button>
              </div>
              <AgentActivityLog />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
