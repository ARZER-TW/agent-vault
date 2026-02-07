"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VaultData, AgentCapData } from "@/lib/vault/types";
import { useVaultStore } from "@/lib/store/vault-store";

const INTERVAL_OPTIONS = [
  { label: "30s", value: 30 },
  { label: "45s", value: 45 },
  { label: "60s", value: 60 },
  { label: "120s", value: 120 },
];

interface VaultApiFields {
  balance: number;
  totalSpent: number;
  txCount: number;
}

interface AutoRunControlsProps {
  vault: VaultData;
  activeAgentCap: AgentCapData | undefined;
  agentAddress: string | null;
  strategy: string;
  isRunning: boolean;
  onSetRunning: (running: boolean) => void;
  onVaultUpdate: (v: VaultApiFields) => void;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

export function AutoRunControls({
  vault,
  activeAgentCap,
  agentAddress,
  strategy,
  isRunning,
  onSetRunning,
  onVaultUpdate,
  addToast,
}: AutoRunControlsProps) {
  const { addAgentLog } = useVaultStore();
  const [isAutoRunEnabled, setIsAutoRunEnabled] = useState(false);
  const [intervalSec, setIntervalSec] = useState(45);
  const [cycleCount, setCycleCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunningRef = useRef(isRunning);

  // Keep ref in sync with prop
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const runOneCycle = useCallback(async () => {
    if (!activeAgentCap || !agentAddress || isRunningRef.current) return;

    onSetRunning(true);
    setLastError(null);
    try {
      const response = await fetch("/api/agent/run", {
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
        throw new Error(detail || json.error || "Agent run failed");
      }

      addAgentLog(json.data);

      if (json.data.vault) {
        onVaultUpdate(json.data.vault);
      }

      setCycleCount((prev) => prev + 1);

      if (json.data.policyCheck?.allowed && json.data.txDigest) {
        addToast("success", `[Auto] Agent executed. TX: ${json.data.txDigest}`);
      } else if (!json.data.policyCheck?.allowed) {
        addToast("info", `[Auto] Policy blocked: ${json.data.policyCheck.reason}`);
      } else {
        addToast("info", "[Auto] Agent decided to hold.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Auto-run cycle failed";
      setLastError(message);
      addToast("error", `[Auto] ${message}`);
    } finally {
      onSetRunning(false);
    }
  }, [vault.id, vault.owner, activeAgentCap, agentAddress, strategy, onSetRunning, onVaultUpdate, addAgentLog, addToast]);

  // Auto-run interval
  useEffect(() => {
    if (isAutoRunEnabled && activeAgentCap && agentAddress) {
      // Run first cycle immediately
      runOneCycle();
      setCountdown(intervalSec);

      // Set up recurring interval
      intervalRef.current = setInterval(() => {
        runOneCycle();
        setCountdown(intervalSec);
      }, intervalSec * 1000);

      // Countdown timer (visual only)
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [isAutoRunEnabled, intervalSec, activeAgentCap, agentAddress, runOneCycle]);

  function handleToggle() {
    if (isAutoRunEnabled) {
      // Stop
      setIsAutoRunEnabled(false);
      setCountdown(0);
      addToast("info", `Auto-run stopped after ${cycleCount} cycles`);
    } else {
      // Start
      if (!activeAgentCap || !agentAddress) {
        addToast("error", "Cannot start auto-run: no authorized AgentCap");
        return;
      }
      setCycleCount(0);
      setLastError(null);
      setIsAutoRunEnabled(true);
      addToast("info", `Auto-run started (every ${intervalSec}s)`);
    }
  }

  const canEnable = !!activeAgentCap && !!agentAddress && Date.now() < vault.policy.expiresAt;

  return (
    <div className="mb-4 p-4 rounded-xl border border-vault-border bg-void/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            Auto-Run
          </span>
          {isAutoRunEnabled && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-emerald-400">
                Active
              </span>
            </span>
          )}
        </div>
        <button
          onClick={handleToggle}
          disabled={!canEnable && !isAutoRunEnabled}
          className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
            isAutoRunEnabled ? "bg-emerald-500" : "bg-elevated"
          }`}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
            style={{ left: isAutoRunEnabled ? "22px" : "2px" }}
          />
        </button>
      </div>

      {/* Interval Selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono text-gray-600">Interval:</span>
        <div className="flex gap-1">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                if (!isAutoRunEnabled) setIntervalSec(opt.value);
              }}
              disabled={isAutoRunEnabled}
              className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${
                intervalSec === opt.value
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-elevated text-gray-500 border border-transparent hover:text-gray-400"
              } disabled:cursor-default`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      {isAutoRunEnabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gray-600">
              Cycles completed: {cycleCount}
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              {isRunning ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 border border-accent/30 border-t-accent rounded-full animate-spin" />
                  Running...
                </span>
              ) : (
                `Next in ${countdown}s`
              )}
            </span>
          </div>

          {/* Countdown bar */}
          <div className="h-0.5 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent/50 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${((intervalSec - countdown) / intervalSec) * 100}%` }}
            />
          </div>

          {lastError && (
            <p className="text-[10px] font-mono text-red-400 truncate" title={lastError}>
              Last error: {lastError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
