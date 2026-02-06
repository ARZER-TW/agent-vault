# AgentVault

> **"Don't give your AI agent the keys. Give it a budget."**

Policy-Based AI Agent Wallet on Sui -- HackMoney 2026 (ETHGlobal)

## What is AgentVault?

AgentVault is the first **policy-based AI agent wallet** on Sui blockchain. Instead of giving your AI agent your private keys, you give it a **budget** with strict on-chain rules.

### The Problem

AI Agents increasingly need to transact autonomously -- calling APIs, purchasing cloud resources, executing DeFi trades. But current solutions either:
- Give agents full private key access (dangerous)
- Require human approval for every transaction (defeats autonomy)
- Only support token allowance caps with no multi-dimensional policy (EVM approve/transferFrom)

### The Solution

AgentVault lets you create a **Vault** (shared on-chain object) with multi-dimensional policy enforcement:

| Policy Dimension     | Description                                          |
|----------------------|------------------------------------------------------|
| **Max Budget**       | Total cumulative spending cap (MIST)                 |
| **Max Per TX**       | Maximum amount per individual transaction            |
| **Allowed Actions**  | Whitelist of permitted operations (e.g., only swaps) |
| **Cooldown**         | Minimum time between consecutive transactions        |
| **Expiration**       | Auto-revoke after deadline (ms timestamp)            |

Your AI agent receives an **AgentCap** (transferable NFT permission token) that only works within these rules. Every withdrawal is validated against all five policy dimensions atomically on-chain. You can revoke the AgentCap instantly at any time.

---

## Architecture

```
+-----------------------------------------------------------+
|  Frontend (Next.js 14 + React 18)                         |
|  zkLogin Auth | Vault Management | Agent Monitor          |
+-----------------------------------------------------------+
           |
+-----------------------------------------------------------+
|  Backend (Next.js API Routes + Agent Runtime)             |
|  Claude API | PTB Builder | Sponsored TX                  |
+-----------------------------------------------------------+
           |
+-----------------------------------------------------------+
|  Sui Blockchain (Testnet)                                 |
|  agent_vault.move | DeepBook V3 (CLOB) | zkLogin (Auth)  |
+-----------------------------------------------------------+
```

### Data Flow

1. **Owner** logs in via zkLogin (Google OAuth) -- no wallet extension needed
2. **Owner** creates a Vault, deposits SUI, sets Policy, mints AgentCap
3. **Agent** fetches market data from DeepBook V3 order book
4. **Agent** sends market snapshot to Claude for analysis
5. **Claude** returns structured `AgentDecision` (action + reasoning + confidence)
6. **Policy Checker** validates the intent off-chain (pre-flight, saves gas)
7. **PTB Builder** composes atomic transaction: `agent_withdraw -> DeepBook swap`
8. **Sponsored TX** executes on-chain -- user and agent pay zero gas
9. **UI** displays TX hash with Sui Explorer link for on-chain verification

**Demo Mode**: Skip step 3-5, inject forced amount to demonstrate policy enforcement directly (over-limit blocked, normal amount passes).

---

## Tech Stack

| Layer       | Technology                              | Version / Package                  |
|-------------|-----------------------------------------|------------------------------------|
| Frontend    | Next.js (App Router) + TypeScript       | next@14.2.35, react@18             |
| Styling     | Tailwind CSS + Vault Noir design system | tailwindcss@3.4.1                  |
| State       | Zustand + React Query                   | zustand@5, @tanstack/react-query@5 |
| Sui SDK     | @mysten/sui, @mysten/zklogin            | @mysten/sui@1.38.0                 |
| DeepBook    | @mysten/deepbook-v3                     | v0.17.0                            |
| AI          | OpenAI / Gemini / Claude (auto-detect)  | gpt-4o, gemini-2.0-flash, claude-sonnet-4-20250514 |
| Contracts   | Sui Move                                | edition 2024.beta, Sui Testnet     |
| Validation  | Zod                                     | zod@3.24.0                         |
| Testing     | Vitest + sui move test                  | vitest@3.0.0                       |

## Why Sui? (And Why This Can't Be Built on EVM)

AgentVault is **not** a project that happens to be on Sui -- it is fundamentally enabled by five Sui-specific features that have no equivalent on EVM chains:

### 1. Object Capabilities (AgentCap as a First-Class Permission Object)

On Sui, capabilities are **objects with identity**. AgentCap is an owned object (`key, store`) that the contract verifies at the Move level:

```move
// Move: AgentCap is a real object -- can be transferred, revoked, checked at compile time
public struct AgentCap has key, store {
    id: UID,
    vault_id: ID,
}
```

On EVM, `approve(spender, amount)` only controls **how much**, not **what actions**, **how often**, or **when it expires**. AgentVault enforces 5 policy dimensions (budget, per-tx limit, action whitelist, cooldown, expiry) in a single atomic check. ERC-20 approve cannot express this.

### 2. Programmable Transaction Blocks (PTB)

One AgentVault transaction atomically composes:

```
agent_withdraw(vault, cap, amount) -> Coin<SUI>
  -> deepbook::swap(coin) -> [baseOut, quoteOut, deepOut]
  -> transferObjects([results], owner)
```

This is **one transaction, one signature, one gas fee**. On EVM, this would require:
- TX 1: `approve()` the DEX contract
- TX 2: `swap()` on the DEX
- TX 3: Transfer results back

Three transactions = three gas fees, three failure points, and a race condition window between TX 1 and TX 2 where funds are exposed.

### 3. zkLogin (Google Login = Sui Address)

AgentVault users sign in with Google. No MetaMask. No seed phrase. No wallet extension.

```
Google OAuth JWT -> ZK Proof -> Sui Address -> Sign Transactions
```

zkLogin is native to Sui's validator set -- the proof is verified on-chain by validators, not by a smart contract. This means zero extra gas cost for ZK verification, unlike EVM's ERC-4337 account abstraction which adds ~200k gas overhead per UserOp.

### 4. Sponsored Transactions (Zero Gas for Users AND Agents)

Both the vault owner and the AI agent pay **zero gas**. A separate sponsor keypair covers gas for all operations:

```typescript
transaction.setSender(agentAddress);      // Agent signs the action
transaction.setGasOwner(sponsorAddress);  // Sponsor pays gas
// Two signatures, one transaction -- native protocol support
```

On EVM, meta-transactions require a Relayer contract, EIP-712 signatures, and a trusted off-chain relayer service. Sui's sponsored TX is a protocol-level primitive with no extra contracts needed.

### 5. Move Linear Type Safety

AgentCap **cannot be copied** -- this is enforced by the Move compiler, not by runtime checks:

```move
// Move compiler REJECTS this: AgentCap has no `copy` ability
let cap2 = cap; // ERROR: cannot copy AgentCap
```

In Solidity, access control relies on `require(msg.sender == owner)` -- a runtime check that can be bypassed by delegate calls, proxy upgrades, or reentrancy. Move's type system eliminates entire classes of vulnerabilities at compile time.

### Summary Table

| Sui Feature          | How AgentVault Uses It                               | EVM Equivalent (And Why It Falls Short)      |
|----------------------|------------------------------------------------------|----------------------------------------------|
| Object Capabilities  | AgentCap = 5-dimensional policy-controlled permission | `approve()` = amount-only, no action/time control |
| PTB                  | withdraw + swap + transfer in one atomic TX          | 3 separate TXs with race conditions          |
| zkLogin              | Google login, native ZK proof on validators          | ERC-4337 adds ~200k gas per operation        |
| Sponsored TX         | Protocol-level gas sponsorship, 2 sigs, 0 contracts | Requires Relayer contract + off-chain infra  |
| Move Linear Types    | AgentCap can't be copied (compiler enforced)         | Solidity modifiers are runtime-only checks   |

---

## Project Structure

```
agent-vault/
+-- contracts/                       # Sui Move smart contracts
|   +-- sources/
|   |   +-- agent_vault.move         # Vault, Policy, AgentCap, OwnerCap (263 lines)
|   |   +-- agent_vault_tests.move   # 15 on-chain tests (all passing)
|   +-- Move.toml
+-- app/                             # Next.js 14 App Router
|   +-- page.tsx                     # Landing page (Vault Noir hero)
|   +-- layout.tsx                   # Root layout with Providers
|   +-- globals.css                  # Vault Noir design system (460 lines)
|   +-- auth/callback/page.tsx       # zkLogin OAuth callback handler
|   +-- vault/
|   |   +-- page.tsx                 # Vault dashboard (list all vaults)
|   |   +-- create/page.tsx          # Create vault form page
|   |   +-- [id]/page.tsx            # Vault detail + agent runtime
|   +-- api/
|       +-- agent/run/route.ts       # POST: execute one agent cycle
|       +-- vault/[id]/route.ts      # GET: fetch vault data
+-- lib/
|   +-- constants.ts                 # Package ID, network, action types, unit conversion
|   +-- sui/
|   |   +-- client.ts               # SuiClient singleton
|   |   +-- deepbook.ts             # DeepBookClient singleton
|   |   +-- market.ts               # Order book snapshots, swap quotes, pool info
|   |   +-- coins.ts                # Fetch SUI coin objects by owner
|   +-- agent/
|   |   +-- runtime.ts              # Agent cycle orchestrator (7-step pipeline)
|   |   +-- claude-client.ts        # Claude API wrapper with system prompt
|   |   +-- intent-parser.ts        # Zod-validated AgentDecision parsing
|   |   +-- policy-checker.ts       # Off-chain policy pre-validation
|   |   +-- __tests__/
|   |       +-- intent-parser.test.ts   # 9 tests
|   |       +-- policy-checker.test.ts  # 11 tests
|   +-- vault/
|   |   +-- types.ts                # VaultData, Policy, AgentCapData, SwapParams
|   |   +-- ptb-builder.ts          # 7 PTB builders (create, deposit, withdraw, swap, etc.)
|   |   +-- service.ts              # On-chain vault queries (getVault, getOwnerCaps, etc.)
|   +-- auth/
|   |   +-- zklogin.ts              # Full zkLogin flow (begin, complete, sign)
|   |   +-- sponsored-tx.ts         # Sponsored + agent transaction execution
|   +-- store/
|       +-- auth-store.ts           # Zustand auth state (address, keypair, zkProof)
|       +-- vault-store.ts          # Zustand vault state (vaults, caps, agent logs)
+-- components/
|   +-- providers.tsx               # React Query provider
|   +-- layout/header.tsx           # Sticky header with nav + login
|   +-- auth/login-button.tsx       # Google zkLogin button
|   +-- vault/vault-card.tsx        # Vault summary card with budget bar
|   +-- vault/create-vault-form.tsx # Full vault creation form
|   +-- agent/agent-activity-log.tsx # Terminal-style agent log viewer
+-- vitest.config.ts
+-- tailwind.config.ts
+-- tsconfig.json
+-- package.json
```

---

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm (recommended) or npm
- Sui CLI (for contract deployment only)
- Google Cloud OAuth Client ID (for zkLogin)
- Anthropic API key (for Claude)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in the required values:

```bash
# Sui Network
NEXT_PUBLIC_SUI_NETWORK=testnet

# Move Contract (already deployed)
NEXT_PUBLIC_PACKAGE_ID=0xbf74c7a7717e74f5074d024e27a5f6d2838d5025e4c67afd758286e3ba6bb31b

# zkLogin - Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/auth/callback

# LLM API (set ONE -- auto-detects provider)
OPENAI_API_KEY=sk-xxx          # or
GEMINI_API_KEY=xxx             # or
ANTHROPIC_API_KEY=sk-ant-xxx

# Sponsor Wallet (pays gas for users)
SPONSOR_PRIVATE_KEY=suiprivkey1xxx

# Agent Wallet (executes trades)
AGENT_PRIVATE_KEY=suiprivkey1xxx
```

### 3. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 4. Run Tests

```bash
# TypeScript unit tests (20 tests)
pnpm vitest run

# Move contract tests (15 tests)
cd contracts && sui move test
```

---

## Move Contract

The core contract is deployed to Sui Testnet at:

```
0xbf74c7a7717e74f5074d024e27a5f6d2838d5025e4c67afd758286e3ba6bb31b
```

### Core Structs

| Struct     | Abilities       | Purpose                                        |
|------------|-----------------|------------------------------------------------|
| `Vault`    | `key`           | Shared object holding SUI balance + policy     |
| `Policy`   | `store, copy, drop` | Multi-dimensional agent operation limits   |
| `AgentCap` | `key, store`    | Transferable permission NFT for agents         |
| `OwnerCap` | `key, store`    | Proof of vault ownership                       |

### Entry Functions

| Function           | Caller | Description                           |
|--------------------|--------|---------------------------------------|
| `create_vault`     | Owner  | Create Vault + set Policy + deposit   |
| `deposit`          | Owner  | Add SUI to Vault                      |
| `withdraw_all`     | Owner  | Withdraw all funds                    |
| `update_policy`    | Owner  | Modify all policy parameters          |
| `create_agent_cap` | Owner  | Mint AgentCap for an agent address    |
| `revoke_agent_cap` | Owner  | Remove AgentCap from authorized list  |
| `agent_withdraw`   | Agent  | Policy-checked withdrawal (10 checks) |

### Error Codes

| Code | Constant               | Trigger                            |
|------|------------------------|------------------------------------|
| 0    | `E_NOT_OWNER`          | OwnerCap vault_id mismatch         |
| 1    | `E_BUDGET_EXCEEDED`    | total_spent + amount > max_budget  |
| 2    | `E_NOT_WHITELISTED`    | Action type not in allowed list    |
| 3    | `E_EXPIRED`            | Current time >= expires_at         |
| 4    | `E_COOLDOWN`           | Time since last tx < cooldown_ms   |
| 5    | `E_INVALID_CAP`        | AgentCap not authorized or wrong vault |
| 6    | `E_INSUFFICIENT_BALANCE` | Vault balance < requested amount |
| 7    | `E_PER_TX_EXCEEDED`    | amount > max_per_tx                |
| 8    | `E_ZERO_AMOUNT`        | amount == 0                        |

### Test Coverage (15/15 passing)

- `test_create_vault` -- Vault creation with initial deposit and policy
- `test_deposit` -- Owner deposits additional funds
- `test_withdraw_all` -- Owner withdraws all funds
- `test_create_agent_cap` -- Minting AgentCap to agent address
- `test_agent_withdraw_success` -- Happy-path agent withdrawal
- `test_agent_withdraw_budget_exceeded` -- Total budget enforcement (6 withdrawals)
- `test_agent_withdraw_per_tx_exceeded` -- Per-transaction limit enforcement
- `test_agent_withdraw_expired` -- Expiry enforcement
- `test_agent_withdraw_cooldown` -- Cooldown enforcement
- `test_agent_withdraw_not_whitelisted` -- Action whitelist enforcement
- `test_agent_withdraw_revoked_cap` -- Revoked cap rejection
- `test_revoke_agent_cap` -- Cap revocation flow
- `test_update_policy` -- Policy update with new parameters
- `test_agent_withdraw_zero_amount` -- Zero amount rejection
- `test_agent_withdraw_multiple_with_cooldown` -- Multi-withdrawal with cooldown respect

---

## Frontend Design

The frontend uses the **Vault Noir** design system:

| Property        | Value                                                    |
|-----------------|----------------------------------------------------------|
| Fonts           | Syne (display), DM Sans (body), JetBrains Mono (code)   |
| Background      | `#060a13` (void) with noise texture overlay              |
| Accent          | `#00d4ff` (cyan) with glow effects                       |
| Secondary       | `#f59e0b` (amber) for warnings/budgets                   |
| Cards           | Glass-morphism (blur + gradient + border)                |
| Animations      | fadeInUp, pulse-glow, ring-rotate, shimmer               |
| Components      | glass-card, btn-primary, btn-ghost, budget-bar, terminal-log |

### Pages

| Route              | Component             | Description                           |
|--------------------|-----------------------|---------------------------------------|
| `/`                | Landing page          | Hero with tagline + how-it-works + tech stack |
| `/vault`           | Vault dashboard       | List all user vaults with VaultCard   |
| `/vault/create`    | Create vault form     | Coin selector + policy configuration  |
| `/vault/[id]`      | Vault detail          | Stats, budget bar, policy, agent runtime |
| `/auth/callback`   | zkLogin callback      | Process OAuth token + ZK proof        |

### API Routes

| Route                  | Method | Description                                         |
|------------------------|--------|-----------------------------------------------------|
| `/api/agent/run`       | POST   | Execute one agent cycle (market -> Claude -> policy -> TX) |
| `/api/agent/demo-run`  | POST   | Demo mode: skip Claude, test policy with forced amount    |
| `/api/vault/[id]`      | GET    | Fetch vault data from chain                         |

---

## Documentation

- [TECH_SPEC.md](./TECH_SPEC.md) -- Full technical specification and design
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) -- 5-day development schedule
- [docs/CONTRIB.md](./docs/CONTRIB.md) -- Development workflow, testing, environment setup
- [docs/RUNBOOK.md](./docs/RUNBOOK.md) -- Deployment, operations, troubleshooting

---

## Status

| Component               | Status             | Details                        |
|-------------------------|--------------------|--------------------------------|
| Move Contracts          | Deployed (Testnet) | 15/15 tests passing            |
| PTB Builder             | Complete           | 7 transaction builders         |
| DeepBook V3 Integration | Complete           | Order book + swap + quotes + fallback |
| Agent Runtime           | Complete           | 7-step pipeline (market -> Claude -> policy -> TX execution) |
| Policy Checker          | Complete           | 6 off-chain validation rules   |
| Intent Parser           | Complete           | Zod-validated + code block extraction |
| zkLogin                 | Complete           | Google OAuth + ZK prover       |
| Sponsored TX            | Complete           | Dual-signature: agent signs action, sponsor pays gas |
| On-chain TX Execution   | Complete           | Sponsored TX with direct fallback |
| Demo Mode               | Complete           | Forced-amount policy testing (skip Claude) |
| Frontend                | Complete           | Vault Noir design, all pages   |
| Unit Tests              | 20/20 passing      | Vitest (intent-parser + policy-checker) |
| Contract Tests          | 15/15 passing      | sui move test                  |

---

## License

MIT
