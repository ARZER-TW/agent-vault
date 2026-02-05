"use client";

import Link from "next/link";
import { LoginButton } from "@/components/auth/login-button";

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-white">AgentVault</span>
          <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded-full">
            Testnet
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/vault"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            My Vaults
          </Link>
          <Link
            href="/vault/create"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Create Vault
          </Link>
          <LoginButton />
        </nav>
      </div>
    </header>
  );
}
