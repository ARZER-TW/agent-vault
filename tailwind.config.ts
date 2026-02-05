import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#060a13",
        deep: "#0a0e1a",
        surface: "#111827",
        elevated: "#1a2236",
        "vault-border": "#1e293b",
        "vault-border-hover": "#334155",
        accent: "#00d4ff",
        "accent-dim": "#0891b2",
        amber: "#f59e0b",
        "amber-dim": "#d97706",
      },
      fontFamily: {
        display: ["Syne", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        body: ["DM Sans", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: [
          "JetBrains Mono",
          "var(--font-geist-mono)",
          "ui-monospace",
          "monospace",
        ],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 212, 255, 0.15)",
        "glow-strong": "0 0 40px rgba(0, 212, 255, 0.25)",
        "glow-amber": "0 0 20px rgba(245, 158, 11, 0.15)",
      },
    },
  },
  plugins: [],
};
export default config;
