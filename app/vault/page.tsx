"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { VaultCard } from "@/components/vault/vault-card";
import { useAuthStore } from "@/lib/store/auth-store";
import { useVaultStore } from "@/lib/store/vault-store";
import { getOwnedVaults, getOwnerCaps } from "@/lib/vault/service";
import Link from "next/link";

export default function VaultListPage() {
  const { address, isLoggedIn } = useAuthStore();
  const { vaults, setVaults, setOwnerCaps, isLoading, setLoading } =
    useVaultStore();

  useEffect(() => {
    if (!address) return;

    async function fetchVaults() {
      setLoading(true);
      try {
        const [caps, vaultData] = await Promise.all([
          getOwnerCaps(address!),
          getOwnedVaults(address!),
        ]);
        setOwnerCaps(caps);
        setVaults(vaultData);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch vaults";
        alert(message);
      } finally {
        setLoading(false);
      }
    }

    fetchVaults();
  }, [address, setVaults, setOwnerCaps, setLoading]);

  return (
    <div className="min-h-screen relative">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Page header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-mono font-medium text-accent tracking-widest uppercase mb-2">
              Dashboard
            </p>
            <h1 className="font-display font-bold text-3xl text-white">
              My Vaults
            </h1>
          </div>
          <Link href="/vault/create" className="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Vault
          </Link>
        </div>

        {!isLoggedIn ? (
          <div className="glass-card p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">Connect your wallet to view vaults.</p>
            <p className="text-sm text-gray-600">
              Login with Google via zkLogin to get started.
            </p>
          </div>
        ) : isLoading ? (
          <div className="glass-card p-16 text-center">
            <div className="w-8 h-8 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-gray-500">Loading vaults...</p>
          </div>
        ) : vaults.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-surface flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="text-gray-600">
                <rect x="4" y="8" width="40" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
                <circle cx="24" cy="25" r="8" stroke="currentColor" strokeWidth="2" />
                <circle cx="24" cy="25" r="3" fill="currentColor" opacity="0.4" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">No vaults found.</p>
            <Link
              href="/vault/create"
              className="text-sm text-accent hover:text-accent/80 transition-colors"
            >
              Create your first vault
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 stagger-children">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
