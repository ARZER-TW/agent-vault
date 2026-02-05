import { Header } from "@/components/layout/header";
import { CreateVaultForm } from "@/components/vault/create-vault-form";

export default function CreateVaultPage() {
  return (
    <div className="min-h-screen relative">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <p className="text-xs font-mono font-medium text-accent tracking-widest uppercase mb-2">
            New Vault
          </p>
          <h1 className="font-display font-bold text-3xl text-white mb-2">
            Create a Policy Vault
          </h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Define spending limits, cooldowns, and allowed actions.
            Your AI agent trades within these guardrails.
          </p>
        </div>
        <CreateVaultForm />
      </main>
    </div>
  );
}
