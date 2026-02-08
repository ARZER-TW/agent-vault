"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { executeDirectZkLoginTransaction } from "@/lib/auth/sponsored-tx";
import { getSuiClient } from "@/lib/sui/client";
import { suiToMist, mistToSui } from "@/lib/constants";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";

const MIN_GAS_RESERVE = suiToMist(0.01);
const SUI_ADDRESS_REGEX = /^0x[0-9a-fA-F]{64}$/;

interface WalletTransferProps {
  senderAddress: string;
  ephemeralKeypair: Ed25519Keypair;
  zkProof: ZkLoginSignatureInputs;
  maxEpoch: number;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

export function WalletTransfer({
  senderAddress,
  ephemeralKeypair,
  zkProof,
  maxEpoch,
  addToast,
}: WalletTransferProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<bigint>(0n);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const client = getSuiClient();
        const result = await client.getBalance({ owner: senderAddress });
        setBalance(BigInt(result.totalBalance));
      } catch {
        setBalance(0n);
      } finally {
        setIsLoadingBalance(false);
      }
    }
    fetchBalance();
  }, [senderAddress]);

  function validateInputs(): string | null {
    if (!SUI_ADDRESS_REGEX.test(recipient)) {
      return "Invalid Sui address (must be 0x + 64 hex characters).";
    }
    if (recipient === senderAddress) {
      return "Cannot transfer to your own address.";
    }
    const amountSui = parseFloat(amount);
    if (!amountSui || amountSui <= 0) {
      return "Please enter a valid amount.";
    }
    const amountMist = suiToMist(amountSui);
    if (amountMist + MIN_GAS_RESERVE > balance) {
      return `Insufficient balance. Need ${mistToSui(amountMist + MIN_GAS_RESERVE).toFixed(4)} SUI (including gas reserve).`;
    }
    return null;
  }

  async function handleTransfer() {
    const error = validateInputs();
    if (error) {
      addToast("error", error);
      return;
    }

    setIsTransferring(true);
    try {
      const amountMist = suiToMist(parseFloat(amount));
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [amountMist]);
      tx.transferObjects([coin], recipient);

      const digest = await executeDirectZkLoginTransaction({
        transaction: tx,
        senderAddress,
        ephemeralKeypair,
        zkProof,
        maxEpoch,
      });

      const client = getSuiClient();
      await client.waitForTransaction({ digest });

      addToast("success", `Transferred ${amount} SUI. TX: ${digest}`);
      setAmount("");
      setRecipient("");

      // Refresh balance
      const result = await client.getBalance({ owner: senderAddress });
      setBalance(BigInt(result.totalBalance));
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  }

  const parsedAmount = parseFloat(amount);
  const isAmountValid = parsedAmount > 0;
  const isAddressValid = SUI_ADDRESS_REGEX.test(recipient);
  const canTransfer = isAmountValid && isAddressValid && !isTransferring;

  return (
    <div className="glass-card p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wider">
          Wallet Transfer
        </h2>
        <div className="text-right">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            Balance
          </span>
          <p className="text-sm font-mono text-accent">
            {isLoadingBalance ? "..." : `${mistToSui(balance).toFixed(4)} SUI`}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="transfer-recipient"
            className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1"
          >
            Recipient Address
          </label>
          <input
            id="transfer-recipient"
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            placeholder="0x..."
            className="vault-input text-sm w-full font-mono"
            aria-label="Recipient Sui address"
          />
          {recipient && !isAddressValid && (
            <p className="text-[10px] text-red-400 mt-1 font-mono">
              Invalid address format
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="transfer-amount"
            className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1"
          >
            Amount (SUI)
          </label>
          <input
            id="transfer-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className="vault-input text-sm w-full"
            aria-label="Transfer amount in SUI"
          />
        </div>

        <button
          onClick={handleTransfer}
          disabled={!canTransfer}
          className="btn-primary w-full text-sm"
          aria-label="Transfer SUI to recipient address"
        >
          {isTransferring ? (
            <>
              <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
              Transferring...
            </>
          ) : (
            "Transfer"
          )}
        </button>
      </div>
    </div>
  );
}
