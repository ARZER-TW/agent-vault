"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { buildCreateVault } from "@/lib/vault/ptb-builder";
import { executeSponsoredTransaction } from "@/lib/auth/sponsored-tx";
import { suiToMist, mistToSui } from "@/lib/constants";
import { getSuiCoins, type CoinItem } from "@/lib/sui/coins";

interface FormData {
  depositAmount: string;
  maxBudget: string;
  maxPerTx: string;
  cooldownSeconds: string;
  expiresInHours: string;
  allowSwap: boolean;
  selectedCoinId: string;
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-mono font-medium text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-600 mt-1.5">{hint}</p>
      )}
    </div>
  );
}

export function CreateVaultForm() {
  const { address, ephemeralKeypair, zkProof, maxEpoch, isLoggedIn } =
    useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [coins, setCoins] = useState<CoinItem[]>([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [form, setForm] = useState<FormData>({
    depositAmount: "1",
    maxBudget: "0.5",
    maxPerTx: "0.1",
    cooldownSeconds: "60",
    expiresInHours: "24",
    allowSwap: true,
    selectedCoinId: "",
  });

  useEffect(() => {
    if (!address) return;

    async function fetchCoins() {
      setIsLoadingCoins(true);
      try {
        const userCoins = await getSuiCoins(address!);
        setCoins(userCoins);
        if (userCoins.length > 0) {
          setForm((prev) => ({
            ...prev,
            selectedCoinId: userCoins[0].objectId,
          }));
        }
      } catch {
        setCoins([]);
      } finally {
        setIsLoadingCoins(false);
      }
    }

    fetchCoins();
  }, [address]);

  function updateField(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const selectedCoin = coins.find((c) => c.objectId === form.selectedCoinId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !ephemeralKeypair || !zkProof || maxEpoch === null) return;

    if (!form.selectedCoinId) {
      alert("Please select a SUI coin to deposit.");
      return;
    }

    try {
      setIsSubmitting(true);

      const allowedActions = form.allowSwap ? [0] : [];
      const cooldownMs = BigInt(Number(form.cooldownSeconds) * 1000);
      const expiresAt = BigInt(
        Date.now() + Number(form.expiresInHours) * 3600 * 1000,
      );

      const tx = buildCreateVault({
        coinObjectId: form.selectedCoinId,
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
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="glass-card p-12">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <p className="text-gray-400 font-body">
            Please login to create a vault.
          </p>
        </div>
      </div>
    );
  }

  if (txDigest) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="glass-card glow-border p-8">
          <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-white text-center mb-2">
            Vault Created
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">
            Your policy-controlled vault is now live on Sui Testnet.
          </p>
          <div className="p-4 rounded-xl bg-void border border-vault-border">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5">
              Transaction Digest
            </p>
            <p className="text-sm font-mono text-accent break-all">
              {txDigest}
            </p>
          </div>
          <button
            onClick={() => setTxDigest(null)}
            className="btn-primary w-full mt-6"
          >
            Create Another Vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg mx-auto"
    >
      <div className="glass-card p-8 space-y-6">
        <div>
          <h2 className="font-display font-bold text-xl text-white mb-1">
            Create New Vault
          </h2>
          <p className="text-sm text-gray-500">
            Configure policy guardrails for your AI agent.
          </p>
        </div>

        {/* Coin Selection */}
        <FormField label="Deposit Coin" hint={
          selectedCoin
            ? `This entire coin (${mistToSui(selectedCoin.balance).toFixed(4)} SUI) will be deposited.`
            : undefined
        }>
          {isLoadingCoins ? (
            <div className="vault-input flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-gray-500">Loading coins...</span>
            </div>
          ) : coins.length === 0 ? (
            <div className="vault-input text-red-400 text-sm">
              No SUI coins found. Please fund your account first.
            </div>
          ) : (
            <select
              value={form.selectedCoinId}
              onChange={(e) => updateField("selectedCoinId", e.target.value)}
              className="vault-input"
            >
              {coins.map((coin) => (
                <option key={coin.objectId} value={coin.objectId}>
                  {mistToSui(coin.balance).toFixed(4)} SUI ({coin.objectId.slice(0, 8)}...{coin.objectId.slice(-4)})
                </option>
              ))}
            </select>
          )}
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Max Budget (SUI)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.maxBudget}
              onChange={(e) => updateField("maxBudget", e.target.value)}
              className="vault-input"
            />
          </FormField>
          <FormField label="Max Per TX (SUI)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.maxPerTx}
              onChange={(e) => updateField("maxPerTx", e.target.value)}
              className="vault-input"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cooldown (sec)">
            <input
              type="number"
              min="0"
              value={form.cooldownSeconds}
              onChange={(e) => updateField("cooldownSeconds", e.target.value)}
              className="vault-input"
            />
          </FormField>
          <FormField label="Expires In (hours)">
            <input
              type="number"
              min="1"
              value={form.expiresInHours}
              onChange={(e) => updateField("expiresInHours", e.target.value)}
              className="vault-input"
            />
          </FormField>
        </div>

        {/* Allowed Actions */}
        <div className="p-4 rounded-xl bg-void/50 border border-vault-border">
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-3">
            Allowed Actions
          </p>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.allowSwap}
                onChange={(e) => updateField("allowSwap", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-md border border-vault-border bg-void peer-checked:bg-accent/20 peer-checked:border-accent/50 transition-all flex items-center justify-center">
                {form.allowSwap && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                    <polyline points="10 3 4.5 8.5 2 6" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                DeepBook Swap
              </p>
              <p className="text-[11px] text-gray-600">
                Allow the agent to execute token swaps
              </p>
            </div>
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || coins.length === 0}
          className="btn-primary w-full"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              Creating Vault...
            </>
          ) : (
            "Create Vault"
          )}
        </button>
      </div>
    </form>
  );
}
