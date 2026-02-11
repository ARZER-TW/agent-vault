"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { buildCreateVault } from "@/lib/vault/ptb-builder";
import { executeDirectZkLoginTransaction } from "@/lib/auth/sponsored-tx";
import {
  suiToMist,
  mistToSui,
  ACTION_SWAP,
  ACTION_STABLE_MINT,
  ACTION_STABLE_BURN,
  ACTION_STABLE_CLAIM,
} from "@/lib/constants";
import { getSuiCoins, type CoinItem } from "@/lib/sui/coins";
import { useToast, ToastContainer } from "@/components/ui/toast";

interface FormData {
  depositAmount: string;
  maxBudget: string;
  maxPerTx: string;
  cooldownSeconds: string;
  expiresInHours: string;
  allowSwap: boolean;
  allowStableMint: boolean;
  allowStableBurn: boolean;
  allowStableClaim: boolean;
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
  const router = useRouter();
  const { address, ephemeralKeypair, zkProof, maxEpoch, isLoggedIn } =
    useAuthStore();
  const { toasts, addToast, dismissToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [coins, setCoins] = useState<CoinItem[]>([]);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);
  const [coinError, setCoinError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    depositAmount: "1",
    maxBudget: "0.5",
    maxPerTx: "0.1",
    cooldownSeconds: "60",
    expiresInHours: "24",
    allowSwap: true,
    allowStableMint: true,
    allowStableBurn: true,
    allowStableClaim: true,
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setCoinError(msg);
        setCoins([]);
      } finally {
        setIsLoadingCoins(false);
      }
    }

    fetchCoins();
  }, [address]);

  async function reloadCoins() {
    if (!address) return;
    setIsLoadingCoins(true);
    setCoinError(null);
    try {
      const userCoins = await getSuiCoins(address);
      setCoins(userCoins);
      if (userCoins.length > 0) {
        setForm((prev) => ({
          ...prev,
          selectedCoinId: userCoins[0].objectId,
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCoinError(msg);
      setCoins([]);
    } finally {
      setIsLoadingCoins(false);
    }
  }

  function updateField(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyRecommended() {
    setForm((prev) => ({
      ...prev,
      depositAmount: "1",
      maxBudget: "0.5",
      maxPerTx: "0.1",
      cooldownSeconds: "60",
      expiresInHours: "24",
      allowSwap: true,
      allowStableMint: true,
      allowStableBurn: true,
      allowStableClaim: true,
    }));
    addToast("info", "Recommended settings applied.");
  }

  const selectedCoin = coins.find((c) => c.objectId === form.selectedCoinId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !ephemeralKeypair || !zkProof || maxEpoch === null) return;

    if (!form.selectedCoinId) {
      addToast("error", "Please select a SUI coin to deposit.");
      return;
    }

    try {
      setIsSubmitting(true);

      const allowedActions: number[] = [];
      if (form.allowSwap) allowedActions.push(ACTION_SWAP);
      if (form.allowStableMint) allowedActions.push(ACTION_STABLE_MINT);
      if (form.allowStableBurn) allowedActions.push(ACTION_STABLE_BURN);
      if (form.allowStableClaim) allowedActions.push(ACTION_STABLE_CLAIM);
      const cooldownMs = BigInt(Number(form.cooldownSeconds) * 1000);
      const expiresAt = BigInt(
        Date.now() + Number(form.expiresInHours) * 3600 * 1000,
      );

      const tx = buildCreateVault({
        coinObjectId: form.selectedCoinId,
        depositAmount: suiToMist(Number(form.depositAmount)),
        maxBudget: suiToMist(Number(form.maxBudget)),
        maxPerTx: suiToMist(Number(form.maxPerTx)),
        allowedActions,
        cooldownMs,
        expiresAt,
        useGasCoin: true, // Use gas coin to avoid coin conflict
      });

      const digest = await executeDirectZkLoginTransaction({
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
      addToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!txDigest) return;
    const timer = setTimeout(() => {
      router.push("/vault");
    }, 2000);
    return () => clearTimeout(timer);
  }, [txDigest, router]);

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
            Your policy-controlled vault is now live on Sui Testnet. Redirecting to dashboard...
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
            onClick={() => router.push("/vault")}
            className="btn-primary w-full mt-6"
            aria-label="Go to vault dashboard"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    <form
      onSubmit={handleSubmit}
      className="max-w-lg mx-auto"
    >
      <div className="glass-card p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-xl text-white mb-1">
              Create New Vault
            </h2>
            <p className="text-sm text-gray-500">
              Configure policy guardrails for your AI agent.
            </p>
          </div>
          <button
            type="button"
            onClick={applyRecommended}
            className="btn-ghost text-xs shrink-0"
            aria-label="Apply recommended vault settings"
          >
            Recommended
          </button>
        </div>

        {/* Coin Selection */}
        <FormField label="Source Coin" hint={
          selectedCoin
            ? `Available: ${mistToSui(selectedCoin.balance).toFixed(4)} SUI`
            : undefined
        }>
          {isLoadingCoins ? (
            <div className="vault-input flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-gray-500">Loading coins...</span>
            </div>
          ) : coins.length === 0 ? (
            <div className="space-y-2">
              <div className="vault-input text-red-400 text-sm">
                {coinError
                  ? `Error loading coins: ${coinError}`
                  : "No SUI coins found. Please fund your account first."}
              </div>
              {address && (
                <p className="text-[10px] font-mono text-gray-600 break-all">
                  Address: {address}
                </p>
              )}
              <button
                type="button"
                onClick={reloadCoins}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
                aria-label="Reload SUI coin list"
              >
                Reload coins
              </button>
            </div>
          ) : (
            <select
              value={form.selectedCoinId}
              onChange={(e) => updateField("selectedCoinId", e.target.value)}
              className="vault-input"
            >
              {coins.map((coin) => (
                <option key={coin.objectId} value={coin.objectId}>
                  {mistToSui(coin.balance).toFixed(4)} SUI
                </option>
              ))}
            </select>
          )}
        </FormField>

        {/* Deposit Amount */}
        <FormField label="Deposit Amount (SUI)" hint={
          selectedCoin
            ? `Max: ${mistToSui(selectedCoin.balance).toFixed(4)} SUI`
            : undefined
        }>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={selectedCoin ? mistToSui(selectedCoin.balance) : undefined}
            value={form.depositAmount}
            onChange={(e) => updateField("depositAmount", e.target.value)}
            className="vault-input"
          />
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
          <div className="space-y-3">
            {([
              { field: "allowSwap" as const, label: "Cetus Swap", desc: "Swap SUI/USDC via Cetus DEX Aggregator" },
              { field: "allowStableMint" as const, label: "Stable Mint", desc: "Mint stablecoins via Stablelayer" },
              { field: "allowStableBurn" as const, label: "Stable Burn", desc: "Burn stablecoins back to USDC" },
              { field: "allowStableClaim" as const, label: "Stable Claim", desc: "Claim yield from Stablelayer" },
            ]).map(({ field, label, desc }) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form[field]}
                    onChange={(e) => updateField(field, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 rounded-md border border-vault-border bg-void peer-checked:bg-accent/20 peer-checked:border-accent/50 transition-all flex items-center justify-center">
                    {form[field] && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                        <polyline points="10 3 4.5 8.5 2 6" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {label}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    {desc}
                  </p>
                </div>
              </label>
            ))}
          </div>
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
    </>
  );
}
