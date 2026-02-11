"use client";

import type { AgentLogEntry } from "@/lib/vault/types";

const EXPLORER_BASE = "https://suiscan.xyz/testnet/tx";

interface LogEntryProps {
  result: AgentLogEntry;
  index: number;
}

function getStatusConfig(result: AgentLogEntry) {
  const { decision, policyCheck } = result;

  if (decision.action === "hold") {
    return {
      tag: "[WAIT]",
      label: "HOLD",
      tagColor: "text-gray-400",
      tagBg: "bg-gray-500/10",
      tagBorder: "border-gray-500/20",
      actionColor: "text-amber",
      actionBg: "bg-amber/10",
      actionBorder: "border-amber/20",
    };
  }

  const ACTION_DISPLAY: Record<string, string> = {
    swap_sui_to_usdc: "SWAP SUI > USDC",
    swap_usdc_to_sui: "SWAP USDC > SUI",
    stable_mint: "STABLE MINT",
    stable_burn: "STABLE BURN",
    stable_claim: "STABLE CLAIM",
  };
  const actionLabel = ACTION_DISPLAY[decision.action] ?? decision.action.toUpperCase();

  if (!policyCheck.allowed) {
    return {
      tag: "[BLOCKED]",
      label: actionLabel,
      tagColor: "text-amber",
      tagBg: "bg-amber/10",
      tagBorder: "border-amber/20",
      actionColor: "text-red-400",
      actionBg: "bg-red-500/10",
      actionBorder: "border-red-500/20",
    };
  }

  return {
    tag: "[OK]",
    label: actionLabel,
    tagColor: "text-accent",
    tagBg: "bg-accent/10",
    tagBorder: "border-accent/20",
    actionColor: "text-emerald-400",
    actionBg: "bg-emerald-500/10",
    actionBorder: "border-emerald-500/20",
  };
}

export function LogEntry({ result, index }: LogEntryProps) {
  const { decision, policyCheck } = result;
  const status = getStatusConfig(result);

  return (
    <div className="p-4 rounded-xl bg-void/50 border border-vault-border hover:border-vault-border-hover transition-colors animate-fade-in-up">
      {/* Header row: index, status tag, action, timestamp, confidence */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-600">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span
            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${status.tagBg} ${status.tagColor} border ${status.tagBorder}`}
          >
            {status.tag}
          </span>
          <span
            className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md ${status.actionBg} ${status.actionColor} border ${status.actionBorder}`}
          >
            {status.label}
          </span>
          {result.timestamp && (
            <span className="text-xs font-mono text-gray-600">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 rounded-full bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${decision.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-gray-500">
            {(decision.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-base text-gray-400 leading-relaxed mb-3">
        {decision.reasoning}
      </p>

      {/* Params */}
      {decision.params && (
        <div className="flex gap-3 text-sm font-mono text-gray-500 mb-3">
          <span>Amount: {decision.params.amount} SUI</span>
          {decision.params.minOut && (
            <span>Min Out: {decision.params.minOut}</span>
          )}
        </div>
      )}

      {/* Blocked indicator */}
      {!policyCheck.allowed && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-lg">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>Blocked: {policyCheck.reason}</span>
        </div>
      )}

      {/* Success indicator with TX link */}
      {policyCheck.allowed && decision.action !== "hold" && (
        <div className="flex items-center justify-between text-sm text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              {result.txDigest
                ? `TX: ${result.txDigest.slice(0, 16)}...`
                : "Transaction executed"}
            </span>
          </div>
          {result.txDigest && (
            <a
              href={`${EXPLORER_BASE}/${result.txDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-white transition-colors font-mono underline"
            >
              View on Explorer
            </a>
          )}
        </div>
      )}
    </div>
  );
}
