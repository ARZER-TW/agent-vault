import Link from "next/link";
import { Header } from "@/components/layout/header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            AgentVault
          </h1>
          <p className="text-xl text-gray-400 mb-2">
            Don&apos;t give your AI agent the keys.
          </p>
          <p className="text-xl text-blue-400 font-medium">
            Give it a budget.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
            <div className="text-2xl mb-3">1</div>
            <h3 className="font-bold mb-2">Create a Vault</h3>
            <p className="text-sm text-gray-400">
              Deposit SUI and set spending limits, cooldowns, and allowed
              actions for your AI agent.
            </p>
          </div>

          <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
            <div className="text-2xl mb-3">2</div>
            <h3 className="font-bold mb-2">Authorize an Agent</h3>
            <p className="text-sm text-gray-400">
              Mint an AgentCap NFT that grants your AI limited, policy-bound
              access to vault funds.
            </p>
          </div>

          <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
            <div className="text-2xl mb-3">3</div>
            <h3 className="font-bold mb-2">AI Trades Safely</h3>
            <p className="text-sm text-gray-400">
              Claude analyzes markets and executes swaps on DeepBook, always
              within your policy guardrails.
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/vault/create"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4">
            <p className="text-2xl font-bold text-white">On-Chain</p>
            <p className="text-xs text-gray-500">Policy Enforcement</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-bold text-white">DeepBook V3</p>
            <p className="text-xs text-gray-500">DEX Integration</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-bold text-white">zkLogin</p>
            <p className="text-xs text-gray-500">Google OAuth</p>
          </div>
          <div className="p-4">
            <p className="text-2xl font-bold text-white">Claude AI</p>
            <p className="text-xs text-gray-500">Market Analysis</p>
          </div>
        </div>
      </main>
    </div>
  );
}
