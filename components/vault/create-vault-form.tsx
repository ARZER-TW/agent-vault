"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { buildCreateVault } from "@/lib/vault/ptb-builder";
import { executeSponsoredTransaction } from "@/lib/auth/sponsored-tx";
import { suiToMist } from "@/lib/constants";

interface FormData {
  depositAmount: string;
  maxBudget: string;
  maxPerTx: string;
  cooldownSeconds: string;
  expiresInHours: string;
  allowSwap: boolean;
}

export function CreateVaultForm() {
  const { address, ephemeralKeypair, zkProof, maxEpoch, isLoggedIn } =
    useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    depositAmount: "1",
    maxBudget: "0.5",
    maxPerTx: "0.1",
    cooldownSeconds: "60",
    expiresInHours: "24",
    allowSwap: true,
  });

  function updateField(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !ephemeralKeypair || !zkProof || maxEpoch === null) return;

    try {
      setIsSubmitting(true);

      const allowedActions = form.allowSwap ? [0] : [];
      const cooldownMs = BigInt(Number(form.cooldownSeconds) * 1000);
      const expiresAt = BigInt(
        Date.now() + Number(form.expiresInHours) * 3600 * 1000,
      );

      // TODO: need a coin object ID from user's wallet
      // For demo, this would come from selecting a coin
      const coinObjectId = "0x_placeholder";

      const tx = buildCreateVault({
        coinObjectId,
        maxBudget: suiToMist(Number(form.maxBudget)),
        maxPerTx: suiToMist(Number(form.maxPerTx)),
        allowedActions,
        cooldownMs,
        expiresAt,
      });

      const digest = await executeSponsoredTransaction({
        transaction: tx,
        senderAddress: address,
        ephemeralKeypair,
        zkProof,
        maxEpoch,
      });

      setTxDigest(digest);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transaction failed";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="text-center py-12 text-gray-500">
        Please login to create a vault.
      </div>
    );
  }

  if (txDigest) {
    return (
      <div className="max-w-lg mx-auto p-6 bg-gray-900 rounded-xl border border-gray-800">
        <h2 className="text-lg font-bold text-green-400 mb-2">
          Vault Created
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Your vault has been created successfully.
        </p>
        <div className="bg-gray-950 p-3 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Transaction Digest</p>
          <p className="text-sm font-mono text-gray-300 break-all">
            {txDigest}
          </p>
        </div>
        <button
          onClick={() => setTxDigest(null)}
          className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          Create Another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg mx-auto space-y-6 p-6 bg-gray-900 rounded-xl border border-gray-800"
    >
      <h2 className="text-lg font-bold text-white">Create New Vault</h2>

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Initial Deposit (SUI)
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={form.depositAmount}
          onChange={(e) => updateField("depositAmount", e.target.value)}
          className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Max Budget (SUI)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.maxBudget}
            onChange={(e) => updateField("maxBudget", e.target.value)}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Max Per TX (SUI)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.maxPerTx}
            onChange={(e) => updateField("maxPerTx", e.target.value)}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Cooldown (seconds)
          </label>
          <input
            type="number"
            min="0"
            value={form.cooldownSeconds}
            onChange={(e) => updateField("cooldownSeconds", e.target.value)}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Expires In (hours)
          </label>
          <input
            type="number"
            min="1"
            value={form.expiresInHours}
            onChange={(e) => updateField("expiresInHours", e.target.value)}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="allowSwap"
          checked={form.allowSwap}
          onChange={(e) => updateField("allowSwap", e.target.checked)}
          className="rounded border-gray-600"
        />
        <label htmlFor="allowSwap" className="text-sm text-gray-400">
          Allow Swap Actions
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
      >
        {isSubmitting ? "Creating..." : "Create Vault"}
      </button>
    </form>
  );
}
