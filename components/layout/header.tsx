"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoginButton } from "@/components/auth/login-button";

export function Header() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/vault", label: "Vaults" },
    { href: "/vault/create", label: "Create" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-vault-border bg-void/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          {/* Vault icon */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors" />
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="relative z-10"
            >
              <rect
                x="1"
                y="3"
                width="16"
                height="13"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-accent"
              />
              <circle
                cx="9"
                cy="9.5"
                r="3"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-accent"
              />
              <circle cx="9" cy="9.5" r="1" fill="currentColor" className="text-accent" />
              <path
                d="M3 3V2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-accent/50"
              />
            </svg>
          </div>

          <span className="font-display font-bold text-lg text-white tracking-tight">
            AgentVault
          </span>

          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
            TESTNET
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? "text-accent bg-accent/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="ml-3 pl-3 border-l border-vault-border">
            <LoginButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
