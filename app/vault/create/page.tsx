import { Header } from "@/components/layout/header";
import { CreateVaultForm } from "@/components/vault/create-vault-form";

export default function CreateVaultPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <CreateVaultForm />
      </main>
    </div>
  );
}
