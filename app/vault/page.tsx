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
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">My Vaults</h1>
          <Link
            href="/vault/create"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Vault
          </Link>
        </div>

        {!isLoggedIn ? (
          <div className="text-center py-16 text-gray-500">
            Please login to view your vaults.
          </div>
        ) : isLoading ? (
          <div className="text-center py-16 text-gray-500">
            Loading vaults...
          </div>
        ) : vaults.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No vaults found.</p>
            <Link
              href="/vault/create"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Create your first vault
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
