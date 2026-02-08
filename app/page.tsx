import Link from "next/link";
import { Header } from "@/components/layout/header";

function TechIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "shield":
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="mx-auto mb-3">
          <path d="M12 2l8 4v6c0 5.5-3.8 10-8 12-4.2-2-8-6.5-8-12V6l8-4z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case "exchange":
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="mx-auto mb-3">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 014-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>
      );
    case "key":
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="mx-auto mb-3">
          <circle cx="8" cy="15" r="5" />
          <path d="M11.7 11.3L15 8l2 2" />
          <path d="M15 8l4-4" />
        </svg>
      );
    case "brain":
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" className="mx-auto mb-3">
          <path d="M12 2a7 7 0 00-4.6 12.3A3 3 0 006 17v1a2 2 0 002 2h8a2 2 0 002-2v-1a3 3 0 00-1.4-2.7A7 7 0 0012 2z" />
          <path d="M9 22v-2" />
          <path d="M15 22v-2" />
          <path d="M9 10h6" />
          <path d="M12 7v6" />
        </svg>
      );
    default:
      return null;
  }
}

function VaultIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      className="text-accent animate-pulse-glow"
    >
      <rect
        x="4"
        y="8"
        width="40"
        height="34"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="24" cy="25" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="25" r="3" fill="currentColor" opacity="0.6" />
      <path
        d="M8 8V5a2 2 0 0 1 2-2h28a2 2 0 0 1 2 2v3"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.4"
      />
      <line x1="24" y1="17" x2="24" y2="14" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="24" y1="36" x2="24" y2="33" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="15" y1="25" x2="12" y2="25" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="36" y1="25" x2="33" y2="25" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    </svg>
  );
}

const features = [
  {
    step: "01",
    title: "Create a Vault",
    description:
      "Deposit SUI and configure spending limits, cooldowns, and allowed actions. Your funds stay under your control.",
    accent: "accent",
  },
  {
    step: "02",
    title: "Authorize an Agent",
    description:
      "Mint an AgentCap NFT that grants your AI limited, policy-bound access to vault funds. Revoke anytime.",
    accent: "amber",
  },
  {
    step: "03",
    title: "AI Trades Safely",
    description:
      "Claude analyzes markets and executes swaps on DeepBook V3. Every transaction is enforced on-chain by your policy.",
    accent: "emerald",
  },
];

const techStack = [
  { label: "On-Chain", sublabel: "Policy Enforcement", icon: "shield" },
  { label: "DeepBook V3", sublabel: "Sui Native DEX", icon: "exchange" },
  { label: "zkLogin", sublabel: "Google OAuth", icon: "key" },
  { label: "Claude AI", sublabel: "Market Analysis", icon: "brain" },
];

export default function Home() {
  return (
    <div className="min-h-screen relative">
      <Header />

      {/* Hero section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 section-gradient" />

        {/* Floating particles */}
        <div className="hero-particles" aria-hidden="true">
          <div className="hero-particle" style={{ top: "15%", left: "10%", "--dx": "40px", "--dy": "-60px", "--dur": "7s", "--delay": "0s", "--size": "3px" } as React.CSSProperties} />
          <div className="hero-particle" style={{ top: "25%", left: "80%", "--dx": "-50px", "--dy": "30px", "--dur": "9s", "--delay": "1s", "--size": "2px" } as React.CSSProperties} />
          <div className="hero-particle" style={{ top: "60%", left: "20%", "--dx": "30px", "--dy": "-40px", "--dur": "8s", "--delay": "2s", "--size": "4px" } as React.CSSProperties} />
          <div className="hero-particle" style={{ top: "70%", left: "75%", "--dx": "-60px", "--dy": "-20px", "--dur": "10s", "--delay": "0.5s", "--size": "2px" } as React.CSSProperties} />
          <div className="hero-particle" style={{ top: "40%", left: "5%", "--dx": "50px", "--dy": "50px", "--dur": "11s", "--delay": "3s", "--size": "3px" } as React.CSSProperties} />
          <div className="hero-particle" style={{ top: "20%", left: "50%", "--dx": "-30px", "--dy": "60px", "--dur": "8.5s", "--delay": "1.5s", "--size": "2px" } as React.CSSProperties} />
          <div className="hero-particle" style={{ top: "80%", left: "45%", "--dx": "20px", "--dy": "-70px", "--dur": "9.5s", "--delay": "4s", "--size": "3px" } as React.CSSProperties} />
          <div className="hero-particle" style={{ top: "50%", left: "90%", "--dx": "-40px", "--dy": "40px", "--dur": "7.5s", "--delay": "2.5s", "--size": "2px" } as React.CSSProperties} />
        </div>

        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        >
          <div className="vault-ring vault-ring-1" />
          <div className="vault-ring vault-ring-2" />
          <div className="vault-ring vault-ring-3" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-32 pb-24 text-center">
          <div className="animate-fade-in-up flex justify-center mb-8">
            <VaultIcon />
          </div>

          <h1
            className="font-display font-extrabold text-5xl md:text-7xl tracking-tight mb-6 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <span className="text-white">Don&apos;t give your AI</span>
            <br />
            <span className="text-white">agent the keys.</span>
            <br />
            <span className="gradient-text">Give it a budget.</span>
          </h1>

          <p
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 animate-fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            Policy-enforced vaults for autonomous AI trading.
            On-chain guardrails. Full owner control. Built on Sui.
          </p>

          <div
            className="flex items-center justify-center gap-4 animate-fade-in-up"
            style={{ animationDelay: "300ms" }}
          >
            <Link href="/vault/create" className="btn-primary text-base !px-8 !py-3">
              Launch App
            </Link>
            <Link href="/vault" className="btn-ghost text-base !px-8 !py-3">
              View Vaults
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="relative max-w-3xl mx-auto px-6 -mt-6 mb-8">
        <div
          className="grid grid-cols-3 gap-4 animate-fade-in-up"
          style={{ animationDelay: "500ms" }}
        >
          <div className="glass-card p-5 text-center">
            <p className="font-display font-extrabold text-3xl gradient-text">
              <span className="count-up-6" />
            </p>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-1">
              Policy Dimensions
            </p>
          </div>
          <div className="glass-card p-5 text-center">
            <p className="font-display font-extrabold text-3xl gradient-text">
              <span className="count-up-3" />
            </p>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-1">
              Step Setup
            </p>
          </div>
          <div className="glass-card p-5 text-center">
            <p className="font-display font-extrabold text-3xl gradient-text">
              <span className="count-up-100" />
              <span className="text-lg">%</span>
            </p>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-1">
              On-Chain Enforced
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs font-mono font-medium text-accent tracking-widest uppercase mb-3">
            How it works
          </p>
          <h2 className="font-display font-bold text-3xl md:text-4xl text-white">
            Three steps to safe AI trading
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
          {features.map((f) => (
            <div
              key={f.step}
              className="glass-card p-8 animate-fade-in-up group hover:shadow-glow transition-shadow duration-300"
            >
              <div className="flex items-center gap-3 mb-5">
                <span
                  className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md ${
                    f.accent === "accent"
                      ? "bg-accent/10 text-accent"
                      : f.accent === "amber"
                        ? "bg-amber/10 text-amber"
                        : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {f.step}
                </span>
              </div>
              <h3 className="font-display font-bold text-lg text-white mb-3">
                {f.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="relative max-w-5xl mx-auto px-6 pb-24">
        <div className="glass-card p-8 md:p-12">
          <div className="text-center mb-10">
            <p className="text-xs font-mono font-medium text-accent tracking-widest uppercase mb-3">
              Built with
            </p>
            <h2 className="font-display font-bold text-2xl text-white">
              Production-grade infrastructure
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 stagger-children">
            {techStack.map((tech) => (
              <div
                key={tech.label}
                className="text-center p-6 rounded-xl bg-void/50 border border-vault-border hover:border-vault-border-hover transition-colors animate-fade-in-up"
              >
                <TechIcon icon={tech.icon} />
                <p className="font-display font-bold text-white text-lg mb-1">
                  {tech.label}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  {tech.sublabel}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-vault-border py-8 text-center">
        <p className="text-xs text-gray-600 font-mono">
          Suistody -- HackMoney 2026 -- Built on Sui
        </p>
      </footer>
    </div>
  );
}
