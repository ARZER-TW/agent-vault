"use client";

import { useState } from "react";

const PRESET_STRATEGIES = [
  {
    label: "Conservative DCA",
    value: "Dollar-cost average: swap a small fixed amount of SUI to USDC every cycle regardless of price. Keep amounts at 25% of max-per-tx limit.",
  },
  {
    label: "Take Profit",
    value: "Only swap SUI to USDC when the mid price is above $3.50. If price is below $3.50, hold and wait for better conditions.",
  },
  {
    label: "Aggressive Trading",
    value: "Use the maximum per-tx amount for every swap. Always swap SUI to USDC. Maximize trading volume.",
  },
  {
    label: "Minimal Risk",
    value: "Always hold. Do not make any swaps unless the spread between bid and ask is less than 0.1%. Preserve capital.",
  },
];

interface StrategyInputProps {
  strategy: string;
  onStrategyChange: (strategy: string) => void;
}

export function StrategyInput({ strategy, onStrategyChange }: StrategyInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  const charCount = strategy.length;
  const isOverLimit = charCount > 500;

  return (
    <div className="glass-card p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider mb-1">
            Natural Language Strategy
          </h2>
          <p className="text-sm text-gray-600 font-mono">
            Tell the AI how to trade in plain language
          </p>
        </div>
        <div className="flex items-center gap-2">
          {strategy.length > 0 && (
            <span className="text-xs font-mono text-accent">Active</span>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`relative w-10 h-5 rounded-full transition-colors ${isOpen ? "bg-accent" : "bg-elevated"}`}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
              style={{ left: isOpen ? "22px" : "2px" }}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-4">
          {/* Preset Strategies */}
          <div className="flex flex-wrap gap-2">
            {PRESET_STRATEGIES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => onStrategyChange(preset.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-colors ${
                  strategy === preset.value
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-vault-border bg-void/30 text-gray-500 hover:border-accent/20 hover:text-gray-400"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Text Input */}
          <div className="relative">
            <textarea
              value={strategy}
              onChange={(e) => onStrategyChange(e.target.value)}
              placeholder="e.g., Only swap when SUI price is above $3.50, keep 50% of budget in reserve..."
              rows={3}
              maxLength={500}
              className="vault-input text-base w-full resize-none font-mono"
            />
            <span
              className={`absolute bottom-2 right-3 text-xs font-mono ${
                isOverLimit ? "text-red-400" : "text-gray-600"
              }`}
            >
              {charCount}/500
            </span>
          </div>

          {/* Clear Button */}
          {strategy.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => onStrategyChange("")}
                className="text-sm font-mono text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear strategy
              </button>
            </div>
          )}

          {/* Active Strategy Preview */}
          {strategy.length > 0 && (
            <div className="p-3 rounded-xl border border-accent/20 bg-accent/5">
              <p className="text-xs font-mono text-accent/60 uppercase tracking-wider mb-1">
                Active Strategy
              </p>
              <p className="text-sm text-gray-400 font-mono leading-relaxed">
                {strategy}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
