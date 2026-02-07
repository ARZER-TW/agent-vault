export function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-vault-border last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-mono text-white">{value}</span>
    </div>
  );
}
