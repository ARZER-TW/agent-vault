export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-6 items-center text-center max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          AgentVault
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Don&apos;t give your AI agent the keys. Give it a budget.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Policy-based AI agent wallet on Sui
        </p>
      </main>
    </div>
  );
}
