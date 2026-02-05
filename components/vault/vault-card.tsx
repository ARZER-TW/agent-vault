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
      className="block p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-600 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-mono text-gray-500 mb-1">Vault</p>
          <p className="text-sm font-mono text-gray-300">
            {vault.id.slice(0, 10)}...{vault.id.slice(-6)}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            isExpired
              ? "bg-red-900/30 text-red-400"
              : "bg-green-900/30 text-green-400"
          }`}
        >
          {isExpired ? "Expired" : "Active"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Balance</p>
          <p className="text-lg font-bold text-white">
            {balanceSui.toFixed(4)} SUI
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Remaining Budget</p>
          <p className="text-lg font-bold text-white">
            {remainingBudget.toFixed(4)} SUI
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Budget Used</span>
          <span>{spentPct}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${Math.min(spentPct, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <span>TX: {vault.txCount}</span>
        <span>Agents: {vault.authorizedCaps.length}</span>
        <span>
          Max/TX: {mistToSui(vault.policy.maxPerTx).toFixed(2)} SUI
        </span>
      </div>
    </Link>
  );
}
