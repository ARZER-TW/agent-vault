"use client";

import { useMemo } from "react";
import { useVaultStore } from "@/lib/store/vault-store";
import { LogEntry } from "@/components/agent/log-entry";

interface LogSummary {
  total: number;
  success: number;
  blocked: number;
  hold: number;
}

function SummaryBar({ summary }: { summary: LogSummary }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-vault-border bg-deep/50">
      <span className="text-xs font-mono text-gray-400">
        Total: <span className="text-white font-bold">{summary.total}</span>
      </span>
      <span className="text-xs font-mono" style={{ color: "var(--color-accent)" }}>
        OK: {summary.success}
      </span>
      <span className="text-xs font-mono" style={{ color: "var(--color-amber)" }}>
        Blocked: {summary.blocked}
      </span>
      <span className="text-xs font-mono text-gray-500">
        Hold: {summary.hold}
      </span>
    </div>
  );
}

export function AgentActivityLog() {
  const { agentLogs, clearAgentLogs } = useVaultStore();

  const summary = useMemo<LogSummary>(() => {
    let success = 0;
    let blocked = 0;
    let hold = 0;

    for (const log of agentLogs) {
      if (log.decision.action === "hold") {
        hold++;
      } else if (!log.policyCheck.allowed) {
        blocked++;
      } else {
        success++;
      }
    }

    return { total: agentLogs.length, success, blocked, hold };
  }, [agentLogs]);

  if (agentLogs.length === 0) {
    return (
      <div className="terminal-log" role="log" aria-label="Agent activity log">
        <div className="terminal-log-header">
          <div className="terminal-dot bg-red-500/60" />
          <div className="terminal-dot bg-amber/60" />
          <div className="terminal-dot bg-emerald-500/60" />
          <span className="ml-2 text-xs text-gray-500">agent-runtime</span>
        </div>
        <div className="p-6 text-center">
          <p className="text-base text-gray-500">
            No agent activity yet.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Run the agent to see AI trading decisions here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-log" role="log" aria-label="Agent activity log" aria-live="polite">
      <div className="terminal-log-header">
        <div className="terminal-dot bg-red-500/60" />
        <div className="terminal-dot bg-amber/60" />
        <div className="terminal-dot bg-emerald-500/60" />
        <span className="ml-2 text-xs text-gray-500">agent-runtime</span>
        <button
          onClick={clearAgentLogs}
          className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors font-mono"
          aria-label="Clear agent activity log"
        >
          clear
        </button>
      </div>

      <SummaryBar summary={summary} />

      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {agentLogs.map((log, i) => (
          <LogEntry key={i} result={log} index={i} />
        ))}
      </div>
    </div>
  );
}
