"use client";

import { useState } from "react";
import type { VaultData, AgentCapData, OwnerCapData } from "@/lib/vault/types";
import {
  buildCreateAgentCap,
  buildRevokeAgentCap,
  buildWithdrawAll,
  buildDepositFromGas,
} from "@/lib/vault/ptb-builder";
import { executeDirectZkLoginTransaction } from "@/lib/auth/sponsored-tx";
import { getSuiClient } from "@/lib/sui/client";
import { mistToSui, suiToMist } from "@/lib/constants";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";

interface OwnerActionsProps {
  vault: VaultData;
  ownerCap: OwnerCapData;
  activeAgentCap: AgentCapData | undefined;
  agentAddress: string | null;
  senderAddress: string;
  ephemeralKeypair: Ed25519Keypair;
  zkProof: ZkLoginSignatureInputs;
  maxEpoch: number;
  onRefreshVault: () => Promise<void>;
  onRefreshAgentCaps: (addr: string) => Promise<void>;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

export function OwnerActions({
  vault,
  ownerCap,
  activeAgentCap,
  agentAddress,
  senderAddress,
  ephemeralKeypair,
  zkProof,
  maxEpoch,
  onRefreshVault,
  onRefreshAgentCaps,
  addToast,
}: OwnerActionsProps) {
  const [isMinting, setIsMinting] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [showDepositForm, setShowDepositForm] = useState(false);

  async function executeTx(buildFn: () => ReturnType<typeof buildDepositFromGas>) {
    const tx = buildFn();
    const digest = await executeDirectZkLoginTransaction({
      transaction: tx,
      senderAddress,
      ephemeralKeypair,
      zkProof,
      maxEpoch,
    });
    const client = getSuiClient();
    await client.waitForTransaction({ digest });
    return digest;
  }

  async function handleMintAgentCap() {
    if (!agentAddress) return;
    setIsMinting(true);
    try {
      const digest = await executeTx(() =>
        buildCreateAgentCap({
          vaultId: vault.id,
          ownerCapId: ownerCap.id,
          agentAddress,
        }),
      );
      addToast("success", `AgentCap minted. TX: ${digest}`);
      await onRefreshVault();
      await onRefreshAgentCaps(agentAddress);
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to mint AgentCap");
    } finally {
      setIsMinting(false);
    }
  }

  async function handleDeposit() {
    const amountSui = parseFloat(depositAmount);
    if (!amountSui || amountSui <= 0) {
      addToast("error", "Please enter a valid deposit amount.");
      return;
    }
    setIsDepositing(true);
    try {
      const digest = await executeTx(() =>
        buildDepositFromGas({
          vaultId: vault.id,
          ownerCapId: ownerCap.id,
          amount: suiToMist(amountSui),
        }),
      );
      addToast("success", `Deposited ${amountSui} SUI. TX: ${digest}`);
      setDepositAmount("");
      setShowDepositForm(false);
      await onRefreshVault();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Deposit failed");
    } finally {
      setIsDepositing(false);
    }
  }

  async function handleWithdrawAll() {
    if (vault.balance <= 0n) {
      addToast("info", "Vault balance is zero.");
      return;
    }
    setIsWithdrawing(true);
    try {
      const digest = await executeTx(() =>
        buildWithdrawAll({
          vaultId: vault.id,
          ownerCapId: ownerCap.id,
          recipientAddress: senderAddress,
        }),
      );
      addToast("success", `Withdrawn all funds. TX: ${digest}`);
      await onRefreshVault();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Withdrawal failed");
    } finally {
      setIsWithdrawing(false);
    }
  }

  async function handleRevokeAgent() {
    if (!activeAgentCap || !agentAddress) return;
    setIsRevoking(true);
    try {
      const digest = await executeTx(() =>
        buildRevokeAgentCap({
          vaultId: vault.id,
          ownerCapId: ownerCap.id,
          capId: activeAgentCap.id,
        }),
      );
      addToast("success", `Agent revoked. TX: ${digest}`);
      await onRefreshVault();
      await onRefreshAgentCaps(agentAddress);
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Revoke failed");
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <div className="glass-card p-6 animate-fade-in-up">
      <h2 className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider mb-4">
        Owner Actions
      </h2>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowDepositForm(!showDepositForm)}
          className="px-4 py-2 rounded-lg text-sm font-mono bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
          aria-label="Toggle deposit form"
        >
          Deposit SUI
        </button>

        <button
          onClick={handleWithdrawAll}
          disabled={isWithdrawing || vault.balance <= 0n}
          className="px-4 py-2 rounded-lg text-sm font-mono bg-amber/10 text-amber border border-amber/20 hover:bg-amber/20 transition-colors disabled:opacity-50"
          aria-label="Withdraw all funds from vault"
        >
          {isWithdrawing ? "Withdrawing..." : "Withdraw All"}
        </button>

        {activeAgentCap && (
          <button
            onClick={handleRevokeAgent}
            disabled={isRevoking}
            className="px-4 py-2 rounded-lg text-sm font-mono bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            aria-label="Revoke agent authorization"
          >
            {isRevoking ? "Revoking..." : "Revoke Agent"}
          </button>
        )}
      </div>

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
            aria-label="Deposit amount in SUI"
          />
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !depositAmount || parseFloat(depositAmount) <= 0}
            className="btn-primary text-sm"
            aria-label="Confirm deposit"
          >
            {isDepositing ? "Depositing..." : "Confirm"}
          </button>
        </div>
      )}

      {/* Mint AgentCap - shown when no authorized cap yet */}
      {!activeAgentCap && agentAddress && (
        <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-accent/5">
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
              aria-label="Mint AgentCap NFT to authorize AI agent"
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
    </div>
  );
}
