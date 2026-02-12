"use client";

import { useEffect, useState } from "react";
import { getVaultEvents } from "@/lib/vault/service";
import { mistToSui, ACTION_LABELS, SUI_NETWORK } from "@/lib/constants";
import type { VaultEvent } from "@/lib/vault/types";

function truncateDigest(digest: string): string {
  if (digest.length <= 16) return digest;
  return `${digest.slice(0, 8)}...${digest.slice(-6)}`;
}

function EventRow({ event }: { event: VaultEvent }) {
  const suiScanUrl = `https://suiscan.xyz/${SUI_NETWORK}/tx/${event.txDigest}`;
  const amountSui = mistToSui(BigInt(event.amount));
  const actionLabel = ACTION_LABELS[event.actionType] ?? `Action ${event.actionType}`;
  const time = event.timestamp > 0
    ? new Date(event.timestamp).toLocaleString()
    : "--";

  return (
    <div className="flex items-center justify-between py-3 border-b border-vault-border last:border-0 text-sm">
      <div className="flex flex-col gap-1 min-w-0">
        <span className="text-gray-400">{time}</span>
        <span className="text-gray-500 font-mono text-xs">{actionLabel}</span>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        <span className="font-mono text-accent">{amountSui.toFixed(4)} SUI</span>
        <a
          href={suiScanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-accent hover:text-white transition-colors"
          aria-label={`View transaction ${event.txDigest} on SuiScan`}
        >
          {truncateDigest(event.txDigest)}
        </a>
      </div>
    </div>
  );
}

export function OnChainAudit({ vaultId, refreshKey = 0 }: { vaultId: string; refreshKey?: number }) {
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      try {
        const data = await getVaultEvents(vaultId);
        if (!cancelled) {
          setEvents(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch events");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [vaultId, refreshKey]);

  return (
    <div className="glass-card p-6 animate-fade-in-up">
      <h2 className="text-sm font-mono font-medium text-gray-500 uppercase tracking-wider mb-4">
        On-Chain Audit Trail
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-400 py-4">{error}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">
          No on-chain events found for this vault.
        </p>
      ) : (
        <div className="divide-y divide-vault-border">
          {events.map((event) => (
            <EventRow key={event.txDigest} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
