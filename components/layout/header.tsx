"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoginButton } from "@/components/auth/login-button";

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
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

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-vault-border bg-void/95 backdrop-blur-xl animate-fade-in-up">
          <nav className="max-w-6xl mx-auto px-6 py-4 space-y-2" aria-label="Mobile navigation">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? "text-accent bg-accent/10"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-3 border-t border-vault-border">
              <LoginButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
