"use client";

import { useVaultStore } from "@/lib/store/vault-store";
import type { AgentLogEntry } from "@/lib/vault/types";

const EXPLORER_BASE = "https://suiscan.xyz/testnet/tx";

function LogEntry({ result, index }: { result: AgentLogEntry; index: number }) {
  const { decision, policyCheck } = result;

  const actionConfig =
    decision.action === "hold"
      ? { label: "HOLD", color: "text-amber", bg: "bg-amber/10", border: "border-amber/20" }
      : policyCheck.allowed
        ? { label: decision.action === "swap_sui_to_usdc" ? "SWAP SUI > USDC" : "SWAP USDC > SUI", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" }
        : { label: decision.action === "swap_sui_to_usdc" ? "SWAP SUI > USDC" : "SWAP USDC > SUI", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" };

  return (
    <div className="p-4 rounded-xl bg-void/50 border border-vault-border hover:border-vault-border-hover transition-colors animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-600">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${actionConfig.bg} ${actionConfig.color} border ${actionConfig.border}`}>
            {actionConfig.label}
          </span>
          {result.timestamp && (
            <span className="text-[10px] font-mono text-gray-600">
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
          <span className="text-[10px] font-mono text-gray-500">
            {(decision.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-400 leading-relaxed mb-3">
        {decision.reasoning}
      </p>

      {decision.params && (
        <div className="flex gap-3 text-[11px] font-mono text-gray-500 mb-3">
          <span>Amount: {decision.params.amount} SUI</span>
          {decision.params.minOut && (
            <span>Min Out: {decision.params.minOut}</span>
          )}
        </div>
      )}

      {!policyCheck.allowed && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>Blocked: {policyCheck.reason}</span>
        </div>
      )}

      {policyCheck.allowed && decision.action !== "hold" && (
        <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
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

export function AgentActivityLog() {
  const { agentLogs, clearAgentLogs } = useVaultStore();

  if (agentLogs.length === 0) {
    return (
      <div className="terminal-log">
        <div className="terminal-log-header">
          <div className="terminal-dot bg-red-500/60" />
          <div className="terminal-dot bg-amber/60" />
          <div className="terminal-dot bg-emerald-500/60" />
          <span className="ml-2 text-[10px] text-gray-500">agent-runtime</span>
        </div>
        <div className="p-6 text-center">
          <p className="text-sm text-gray-500">
            No agent activity yet.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Run the agent to see AI trading decisions here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-log">
      <div className="terminal-log-header">
        <div className="terminal-dot bg-red-500/60" />
        <div className="terminal-dot bg-amber/60" />
        <div className="terminal-dot bg-emerald-500/60" />
        <span className="ml-2 text-[10px] text-gray-500">agent-runtime</span>
        <button
          onClick={clearAgentLogs}
          className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors font-mono"
        >
          clear
        </button>
      </div>
      <div className="p-4 space-y-3">
        {agentLogs.map((log, i) => (
          <LogEntry key={i} result={log} index={i} />
        ))}
      </div>
    </div>
  );
}
