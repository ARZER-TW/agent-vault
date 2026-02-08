"use client";

import { useState } from "react";
import type { VaultData, AgentCapData } from "@/lib/vault/types";
import { useVaultStore } from "@/lib/store/vault-store";

interface VaultApiFields {
  balance: number;
  totalSpent: number;
  txCount: number;
}

interface CopilotPanelProps {
  vault: VaultData;
  activeAgentCap: AgentCapData | undefined;
  agentAddress: string | null;
  strategy: string;
  isRunning: boolean;
  onSetRunning: (running: boolean) => void;
  onVaultUpdate: (v: VaultApiFields) => void;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

interface ProposalDecision {
  action: "swap_sui_to_usdc" | "swap_usdc_to_sui" | "hold";
  reasoning: string;
  confidence: number;
  params?: { amount?: string; minOut?: string };
}

interface PendingProposal {
  decision: ProposalDecision;
  policyCheck: {
    allowed: boolean;
    reason: string;
  };
  market: {
    midPrice: number;
    timestamp: number;
    source: string;
  };
  timestamp: number;
}

export function CopilotPanel({
  vault,
  activeAgentCap,
  agentAddress,
  strategy,
  isRunning,
  onSetRunning,
  onVaultUpdate,
  addToast,
}: CopilotPanelProps) {
  const { addAgentLog } = useVaultStore();
  const [isCopilotEnabled, setIsCopilotEnabled] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [proposal, setProposal] = useState<PendingProposal | null>(null);

  const canEnable = !!activeAgentCap && !!agentAddress && Date.now() < vault.policy.expiresAt;

  async function handleGetSuggestion() {
    if (!activeAgentCap || !agentAddress) return;

    setIsFetching(true);
    setProposal(null);
    try {
      const response = await fetch("/api/agent/copilot-suggest", {
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
        throw new Error(detail || json.error || "Copilot suggest failed");
      }

      setProposal(json.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get suggestion";
      addToast("error", message);
    } finally {
      setIsFetching(false);
    }
  }

  async function handleApprove() {
    if (!proposal || !activeAgentCap || !agentAddress) return;
    if (proposal.decision.action === "hold" || !proposal.policyCheck.allowed) return;

    setIsExecuting(true);
    onSetRunning(true);
    try {
      const response = await fetch("/api/agent/copilot-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId: vault.id,
          agentCapId: activeAgentCap.id,
          agentAddress,
          ownerAddress: vault.owner,
          action: proposal.decision.action,
          amount: proposal.decision.params?.amount ?? "0",
          minOut: proposal.decision.params?.minOut,
        }),
      });

      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Copilot execute failed");
      }

      addAgentLog({
        decision: {
          action: proposal.decision.action,
          reasoning: proposal.decision.reasoning,
          confidence: proposal.decision.confidence,
          params: proposal.decision.params?.amount
            ? { amount: proposal.decision.params.amount, minOut: proposal.decision.params.minOut }
            : undefined,
        },
        policyCheck: proposal.policyCheck,
        txDigest: json.data.txDigest,
        timestamp: json.data.timestamp,
        hasTransaction: true,
      });

      if (json.data.vault) {
        onVaultUpdate(json.data.vault);
      }

      addToast("success", `Copilot TX executed: ${json.data.txDigest}`);
      setProposal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      addToast("error", message);
    } finally {
      setIsExecuting(false);
      onSetRunning(false);
    }
  }

  function handleReject() {
    setProposal(null);
    addToast("info", "Proposal rejected");
  }

  function formatAction(action: string): string {
    switch (action) {
      case "swap_sui_to_usdc": return "SWAP SUI > USDC";
      case "swap_usdc_to_sui": return "SWAP USDC > SUI";
      case "hold": return "HOLD";
      default: return action.toUpperCase();
    }
  }

  return (
    <div className="mb-4 p-4 rounded-xl border border-vault-border bg-void/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Copilot Mode
          </span>
          <span className="text-xs font-mono text-gray-600">
            (suggest then approve)
          </span>
        </div>
        <button
          onClick={() => {
            setIsCopilotEnabled(!isCopilotEnabled);
            if (isCopilotEnabled) {
              setProposal(null);
            }
          }}
          disabled={!canEnable && !isCopilotEnabled}
          className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
            isCopilotEnabled ? "bg-accent" : "bg-elevated"
          }`}
          role="switch"
          aria-checked={isCopilotEnabled}
          aria-label="Toggle copilot mode"
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ left: isCopilotEnabled ? "22px" : "2px" }}
          />
        </button>
      </div>

      {isCopilotEnabled && (
        <div className="space-y-3">
          {/* Get Suggestion Button */}
          {!proposal && (
            <button
              onClick={handleGetSuggestion}
              disabled={isFetching || isRunning || !activeAgentCap}
              className="w-full btn-primary"
              aria-label="Get AI trading suggestion"
            >
              {isFetching ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-void/30 border-t-void rounded-full animate-spin" />
                  Analyzing...
                </span>
              ) : (
                "Get AI Suggestion"
              )}
            </button>
          )}

          {/* Proposal Card */}
          {proposal && (
            <div className="rounded-lg border border-vault-border bg-deep/50 p-4 space-y-3">
              {/* Action Badge */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium ${
                  proposal.decision.action === "hold"
                    ? "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    : proposal.decision.action === "swap_sui_to_usdc"
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "bg-amber/10 text-amber border border-amber/20"
                }`}>
                  {formatAction(proposal.decision.action)}
                </span>
                {proposal.decision.params?.amount && proposal.decision.action !== "hold" && (
                  <span className="text-sm font-mono text-white">
                    {proposal.decision.params.amount} SUI
                  </span>
                )}
              </div>

              {/* Confidence Bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-500">Confidence</span>
                  <span className="text-xs font-mono text-gray-400">
                    {(proposal.decision.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      proposal.decision.confidence >= 0.7
                        ? "bg-emerald-400"
                        : proposal.decision.confidence >= 0.5
                          ? "bg-amber"
                          : "bg-red-400"
                    }`}
                    style={{ width: `${proposal.decision.confidence * 100}%` }}
                  />
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <span className="text-xs font-mono text-gray-500 block mb-1">Reasoning</span>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {proposal.decision.reasoning}
                </p>
              </div>

              {/* Market Data */}
              <div className="flex items-center gap-3 text-xs font-mono text-gray-500">
                <span>Mid: ${proposal.market.midPrice.toFixed(4)}</span>
                <span>Source: {proposal.market.source}</span>
              </div>

              {/* Policy Check */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono ${
                proposal.policyCheck.allowed
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  proposal.policyCheck.allowed ? "bg-emerald-400" : "bg-red-400"
                }`} />
                {proposal.policyCheck.allowed ? "ALLOWED" : "BLOCKED"}: {proposal.policyCheck.reason}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                {proposal.decision.action !== "hold" && proposal.policyCheck.allowed && (
                  <button
                    onClick={handleApprove}
                    disabled={isExecuting || isRunning}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    aria-label="Approve and execute this proposal"
                  >
                    {isExecuting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                        Executing...
                      </span>
                    ) : (
                      "Approve & Execute"
                    )}
                  </button>
                )}
                <button
                  onClick={handleReject}
                  disabled={isExecuting}
                  className={`${
                    proposal.decision.action === "hold" || !proposal.policyCheck.allowed
                      ? "flex-1"
                      : ""
                  } px-4 py-2.5 rounded-lg text-sm font-mono text-gray-400 border border-vault-border hover:text-gray-300 hover:border-gray-600 transition-colors disabled:opacity-50`}
                  aria-label="Reject this proposal"
                >
                  {proposal.decision.action === "hold" ? "Dismiss" : "Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
