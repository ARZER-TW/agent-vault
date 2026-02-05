# AgentVault

> **"Don't give your AI agent the keys. Give it a budget."**

Policy-Based AI Agent Wallet on Sui - HackMoney 2026 (ETHGlobal)

## What is AgentVault?

AgentVault is the first **policy-based AI agent wallet** on Sui blockchain. Instead of giving your AI agent your private keys, you give it a **budget** with strict rules.

### The Problem

AI Agents increasingly need to transact autonomously - calling APIs, purchasing cloud resources, executing DeFi trades. But current solutions either:
- Give agents full private key access (dangerous)
- Require human approval for every transaction (defeats autonomy)

### The Solution

AgentVault lets you create a **Vault** with:
- **Budget limits** - Total spending cap
- **Per-transaction limits** - Max amount per action
- **Allowed actions** - Whitelist of permitted operations (e.g., only swaps)
- **Cooldown periods** - Minimum time between transactions
- **Expiration** - Auto-revoke after deadline

Your AI agent receives an **AgentCap** (permission token) that only works within these rules. You can revoke it instantly at any time.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Blockchain**: Sui (Move smart contracts)
- **DEX**: DeepBook V3
- **AI**: Claude API
- **Auth**: zkLogin (Google OAuth)
- **UX**: Sponsored Transactions (zero gas for users)

## Why Sui?

| Feature | How We Use It | Why Other Chains Can't |
|---------|---------------|------------------------|
| Object Capabilities | AgentCap as transferable permission NFT | EVM approve() can't do fine-grained control |
| PTB | Atomic: check policy + withdraw + swap in one tx | EVM needs multiple transactions |
| zkLogin | Google login, no wallet extension needed | Not native on other chains |
| Sponsored TX | Users pay zero gas | Meta-tx on EVM is complex |
| Move Type Safety | AgentCap can't be copied or forged | Solidity modifiers can be bypassed |

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Fill in your API keys

# Run development server
pnpm dev

# Deploy contracts (requires Sui CLI)
cd contracts
sui move build
sui move test
sui client publish --gas-budget 100000000
```

## Project Structure

```
agent-vault/
├── contracts/          # Sui Move smart contracts
│   └── sources/
│       ├── vault.move  # Vault, Policy, AgentCap
│       └── actions.move
├── app/                # Next.js App Router
│   ├── api/            # API routes
│   └── vault/          # Vault management pages
├── lib/
│   ├── sui/            # Sui SDK, zkLogin, DeepBook
│   ├── agent/          # Claude AI, Policy checker
│   └── vault/          # PTB builder, types
└── components/         # React components
```

## Documentation

- [Technical Specification](./TECH_SPEC.md) - Full architecture and design
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Development schedule

## License

MIT
