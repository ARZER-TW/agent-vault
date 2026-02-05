"use client";

import Link from "next/link";
import type { VaultData } from "@/lib/vault/types";
import { mistToSui } from "@/lib/constants";

export function VaultCard({ vault }: { vault: VaultData }) {
  const balanceSui = mistToSui(vault.balance);
  const remainingBudget = mistToSui(vault.policy.maxBudget - vault.totalSpent);
  const spentPct =
    vault.policy.maxBudget > 0n
      ? Number((vault.totalSpent * 100n) / vault.policy.maxBudget)
      : 0;
  const isExpired = Date.now() >= vault.policy.expiresAt;

  return (
    <Link
      href={`/vault/${vault.id}`}
      className="glass-card p-6 block group hover:shadow-glow transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider mb-1">
            Vault
          </p>
          <p className="text-sm font-mono text-gray-300 group-hover:text-accent transition-colors">
            {vault.id.slice(0, 10)}...{vault.id.slice(-6)}
          </p>
        </div>
        <span className={isExpired ? "badge-expired" : "badge-active"}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isExpired ? "bg-red-400" : "bg-emerald-400"
            }`}
          />
          {isExpired ? "Expired" : "Active"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
            Balance
          </p>
          <p className="text-xl font-display font-bold text-white">
            {balanceSui.toFixed(4)}
            <span className="text-xs text-gray-500 ml-1 font-mono">SUI</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">
            Budget Left
          </p>
          <p className="text-xl font-display font-bold text-white">
            {remainingBudget.toFixed(4)}
            <span className="text-xs text-gray-500 ml-1 font-mono">SUI</span>
          </p>
        </div>
      </div>

      {/* Budget bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1.5">
          <span>Budget Used</span>
          <span className={spentPct > 80 ? "text-amber" : "text-gray-400"}>
            {spentPct}%
          </span>
        </div>
        <div className="budget-bar">
          <div
            className="budget-bar-fill"
            style={{ width: `${Math.min(spentPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4 pt-4 border-t border-vault-border text-[10px] font-mono text-gray-500">
        <span>TX: {vault.txCount}</span>
        <span>Agents: {vault.authorizedCaps.length}</span>
        <span>
          Max/TX: {mistToSui(vault.policy.maxPerTx).toFixed(2)} SUI
        </span>
      </div>
    </Link>
  );
}
