"use client";

import { useVaultStore } from "@/lib/store/vault-store";
import type { AgentRunResult } from "@/lib/agent/runtime";

function LogEntry({ result }: { result: AgentRunResult }) {
  const { decision, policyCheck } = result;

  const actionColor =
    decision.action === "hold"
      ? "text-yellow-400"
      : policyCheck.allowed
        ? "text-green-400"
        : "text-red-400";

  const actionLabel =
    decision.action === "hold"
      ? "HOLD"
      : decision.action === "swap_sui_to_usdc"
        ? "SWAP SUI->USDC"
        : "SWAP USDC->SUI";

  return (
    <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${actionColor}`}>
          {actionLabel}
        </span>
        <span className="text-xs text-gray-500">
          Confidence: {(decision.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-2">{decision.reasoning}</p>

      {decision.params && (
        <div className="text-xs text-gray-500 mb-2">
          Amount: {decision.params.amount} SUI
          {decision.params.minOut && ` | Min Out: ${decision.params.minOut}`}
        </div>
      )}

      {!policyCheck.allowed && (
        <div className="text-xs text-red-400/80 bg-red-900/20 px-2 py-1 rounded">
          Blocked: {policyCheck.reason}
        </div>
      )}

      {policyCheck.allowed && decision.action !== "hold" && (
        <div className="text-xs text-green-400/80 bg-green-900/20 px-2 py-1 rounded">
          Transaction built successfully
        </div>
      )}
    </div>
  );
}

export function AgentActivityLog() {
  const { agentLogs, clearAgentLogs } = useVaultStore();

  if (agentLogs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No agent activity yet. Start the agent to see decisions here.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-300">Agent Activity</h3>
        <button
          onClick={clearAgentLogs}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-3">
        {agentLogs.map((log, i) => (
          <LogEntry key={i} result={log} />
        ))}
      </div>
    </div>
  );
}
