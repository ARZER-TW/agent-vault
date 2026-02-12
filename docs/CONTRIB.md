# Suistody -- Development Guide

> 開發工作流程、測試程序、環境設定指南

**Last Updated:** 2026-02-11

---

## Prerequisites

| Tool       | Version  | Purpose                          | Install                                |
|------------|----------|----------------------------------|----------------------------------------|
| Node.js    | >= 18    | JavaScript runtime               | https://nodejs.org/                    |
| npm        | >= 9     | Package manager                  | Bundled with Node.js                   |
| Sui CLI    | latest   | Move contract build/deploy/test  | https://docs.sui.io/build/install      |
| TypeScript | >= 5     | Type checking (included in devDeps) | Installed via npm                  |

### Optional

| Tool              | Purpose                                     |
|-------------------|---------------------------------------------|
| Google Cloud Console | Create OAuth Client ID (for zkLogin)     |
| OpenAI / Anthropic / Google AI Console | Obtain LLM API Key    |
| Sui Testnet Faucet | Fund Sponsor/Agent wallets with test SUI   |

---

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/ARZER-TW/agent-vault.git
cd agent-vault
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

All environment variables reference:

| Variable                        | Required | Scope        | Description                                                  |
|---------------------------------|----------|--------------|--------------------------------------------------------------|
| `NEXT_PUBLIC_SUI_NETWORK`       | Yes      | Client+Server | Sui network: `testnet` (default), `devnet`, or `mainnet`   |
| `NEXT_PUBLIC_PACKAGE_ID`        | Yes      | Client+Server | Deployed Move contract Package ID                           |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`  | Yes      | Client       | Google OAuth 2.0 Client ID (for zkLogin)                     |
| `GOOGLE_CLIENT_SECRET`          | Yes      | Server       | Google OAuth 2.0 Client Secret                               |
| `NEXT_PUBLIC_REDIRECT_URI`      | Yes      | Client       | OAuth callback URL (default: `http://localhost:3000/auth/callback`) |
| ~~`NEXT_PUBLIC_ENOKI_API_KEY`~~ | No       | --           | Removed: now uses Mysten public ZK prover (no API key needed) |
| `OPENAI_API_KEY`                | One of three | Server   | OpenAI API key (`sk-...`). Model: `gpt-4o`                   |
| `GEMINI_API_KEY`                | One of three | Server   | Google Gemini API key. Model: `gemini-2.0-flash`             |
| `ANTHROPIC_API_KEY`             | One of three | Server   | Anthropic API key (`sk-ant-...`). Model: `claude-sonnet-4-20250514`      |
| `LLM_PROVIDER`                  | No       | Server       | Force a specific LLM provider: `openai`, `gemini`, or `anthropic`. Auto-detects if unset. |
| `SPONSOR_PRIVATE_KEY`           | Yes      | Server       | Sui Ed25519 private key for gas sponsorship (`suiprivkey1...`) |
| `AGENT_PRIVATE_KEY`             | Yes      | Server       | Sui Ed25519 private key for agent trade execution (`suiprivkey1...`) |

**LLM Auto-Detection Priority:** If `LLM_PROVIDER` is not set, the system checks API keys in this order: `OPENAI_API_KEY` > `GEMINI_API_KEY` > `ANTHROPIC_API_KEY`. The first key found determines the provider.

**Security Warning**: `.env.local` is listed in `.gitignore`. Never commit private keys to version control.

### 3. Generate Wallet Keys

Sponsor and Agent wallets need testnet SUI:

```bash
# Generate a new Ed25519 keypair
sui keytool generate ed25519

# Fund from Sui Testnet faucet
sui client faucet --address <YOUR_ADDRESS>
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application type)
3. Add authorized redirect URI: `http://localhost:3000/auth/callback`
4. Copy Client ID and Secret to `.env.local`

### 5. ZK Prover (No Setup Required)

zkLogin ZK proofs are generated via Mysten Labs public prover (free, no API key).
- Testnet: `https://prover-dev.mystenlabs.com/v1`
- Mainnet: `https://prover.mystenlabs.com/v1`

---

## Available Scripts

### npm Scripts (package.json)

| Command             | Description                                   |
|---------------------|-----------------------------------------------|
| `npm run dev`      | Start Next.js dev server (http://localhost:3000) |
| `npm run build`    | Production build                              |
| `npm run start`    | Start production server                       |
| `npm run lint`     | ESLint check                                  |

### Test Commands

| Command                                                 | Description                      |
|---------------------------------------------------------|----------------------------------|
| `npm test`                                              | Run all TypeScript unit tests (78 tests) |
| `npm run test:watch`                                    | Watch mode unit tests            |
| `npx vitest run lib/agent/__tests__/policy-checker.test.ts` | Run specific test file     |
| `cd contracts && sui move test`                         | Run Move contract tests (15 tests) |

### Move Contract Commands

```bash
cd contracts

# Build
sui move build

# Test (15 tests)
sui move test

# Deploy to Testnet
sui client publish --gas-budget 100000000

# After deployment, update NEXT_PUBLIC_PACKAGE_ID in .env.local
```

### Utility Scripts

Currently no standalone utility scripts. Cetus Aggregator and Stablelayer SDK connectivity is verified through the test suite and the agent runtime.

---

## Development Workflow

### Git Workflow

**Mandatory Rule**: Commit and push after every completed feature or file.

```bash
# Commit format
git add <specific-files>
git commit -m "type: description"
git push

# Types:
# feat     - New feature
# fix      - Bug fix
# docs     - Documentation update
# refactor - Code restructuring
# test     - Test addition/modification
# chore    - Maintenance
```

Do NOT accumulate large changes before committing.

### Local Development Cycle

1. Start dev server: `npm run dev`
2. Make code changes
3. Verify in browser at `http://localhost:3000`
4. Run tests: `npm test`
5. Commit and push

---

## Project Architecture

### Module Dependency Graph

```
app/ (pages + API routes)
  |
  +-- components/ (React UI)
  |     |
  +-- lib/store/ (Zustand state management)
  |     |
  +-- lib/agent/ (AI agent runtime)
  |     |     |
  |     |     +-- lib/vault/service.ts (on-chain queries)
  |     |     +-- lib/sui/market.ts (Cetus Aggregator market data)
  |     |     +-- lib/vault/ptb-agent.ts (Cetus swap + Stablelayer PTBs, server-only)
  |     |     +-- LLM API (OpenAI / Gemini / Anthropic)
  |     |
  +-- lib/vault/ptb-builder.ts (Owner + basic agent PTBs, browser-safe)
  |     |
  +-- lib/auth/ (zkLogin + Sponsored TX)
  |     |
  +-- lib/sui/ (SuiClient + CetusClient + StablelayerClient singletons)
  |     |
  +-- lib/constants.ts (shared configuration)
```

### API Routes

| Route                      | Method | Purpose                                                     |
|----------------------------|--------|-------------------------------------------------------------|
| `/api/agent/run`           | POST   | Execute one agent cycle (market -> LLM -> policy -> TX)     |
| `/api/agent/demo-run`      | POST   | Demo mode: skip LLM, test policy with forced amount         |
| `/api/agent/policy-test`   | POST   | Guardrail stress test: adversarial policy violation attempts |
| `/api/agent/address`       | GET    | Return agent wallet address                                 |
| `/api/vault/[id]`          | GET    | Fetch vault data from chain                                 |
| `/api/sponsor/address`     | GET    | Return sponsor wallet address                               |
| `/api/sponsor/sign-and-execute` | POST | Co-sign and execute sponsored transaction             |

### Key Design Decisions

1. **Balance<SUI> not Coin** -- Contract uses `Balance<SUI>` for fund storage (more efficient)
2. **AgentCap as key, store** -- Makes AgentCap transferable to different addresses
3. **Shared Vault object** -- Uses `transfer::share_object` for universal readability
4. **Off-chain policy pre-check** -- Validates in `policy-checker.ts` before sending TX (saves gas)
5. **BigInt for amounts** -- All monetary amounts in TypeScript use `bigint` to avoid precision issues
6. **MIST as unit** -- Contract internally uses MIST (1 SUI = 1,000,000,000 MIST)
7. **Multi-LLM support** -- Auto-detects provider from API keys; supports OpenAI, Gemini, Anthropic
8. **Sponsored TX with fallback** -- Tries sponsored execution first, falls back to agent-paid gas

### Sponsored TX Fallback Flow

Agent transactions use a dual-execution strategy defined in `lib/auth/sponsored-tx.ts` and orchestrated by `lib/agent/runtime.ts`:

```
Agent wants to execute a trade
  |
  v
executeSponsoredAgentTransaction()
  - transaction.setSender(agentAddress)
  - transaction.setGasOwner(sponsorAddress)
  - Build TX bytes
  - agentKeypair.signTransaction(txBytes)    -- Agent signs the action
  - sponsorKeypair.signTransaction(txBytes)  -- Sponsor signs for gas
  - executeTransactionBlock([agentSig, sponsorSig])
  |
  +-- Success? --> return txDigest
  |
  +-- Failure? --> Fallback path:
        |
        v
      Reset TX: setSender(agentAddress), setGasOwner(agentAddress)
        |
        v
      executeAgentTransaction()
        - signAndExecuteTransaction(agentKeypair)  -- Agent pays own gas
        |
        +-- Success? --> return txDigest
        +-- Failure? --> Return error with both error messages
```

**Why the reset is needed:** The sponsored path mutates the Transaction object by setting `gasOwner` to the sponsor address. If that path fails, the TX still has the sponsor as gas owner. The fallback must explicitly reset both `sender` and `gasOwner` to the agent's address before retrying.

**Three TX execution modes in the codebase:**

| Function | Signer | Gas Payer | Use Case |
|----------|--------|-----------|----------|
| `executeSponsoredAgentTransaction` | Agent keypair | Sponsor keypair | Default agent trades |
| `executeAgentTransaction` | Agent keypair | Agent keypair | Fallback when sponsor fails |
| `executeDirectZkLoginTransaction` | Ephemeral key + zkLogin | User (zkLogin address) | Owner operations (deposit, withdraw, create vault) |

### State Management Lifecycle

The app uses two Zustand stores with different persistence characteristics:

| Store | Persistence | Lost When | Contains |
|-------|------------|-----------|----------|
| `useAuthStore` | Backed by `sessionStorage` via `zklogin.ts` | Browser tab closes | zkLogin address, ephemeral keypair, ZK proof, maxEpoch |
| `useVaultStore` | In-memory only (no persistence) | Page refresh or tab close | Vault list, agent logs, selected vault |

**Implications for developers:**
- `useAuthStore` data survives page refresh (restored from `sessionStorage` in `layout.tsx`)
- `useAuthStore` data is lost when the tab closes (new tab = must re-login via Google)
- `useVaultStore.agentLogs` accumulates during a session but resets on refresh -- this is intentional (on-chain audit trail provides permanent history)
- Vault data in `useVaultStore` is always re-fetched from chain on page load, never cached across sessions

---

## Testing

### TypeScript Tests (Vitest)

Current test coverage (78 tests across 6 files):

| Test File                   | Tests | Coverage Area                                    |
|-----------------------------|-------|--------------------------------------------------|
| `intent-parser.test.ts`     | 20    | JSON parsing, Zod validation, code block handling, Unicode, all action types |
| `policy-checker.test.ts`    | 14    | All 6 policy rules boundary conditions + non-withdrawal actions |
| `constants.test.ts`         | 11    | suiToMist and mistToSui unit conversion          |
| `ptb-builder.test.ts`       | 13    | Owner PTB builders (create vault, deposit, withdraw, agent ops) |
| `ptb-agent.test.ts`         | 6     | Cetus swap + Stablelayer mint/burn/claim PTB builders |
| `service.test.ts`           | 14    | On-chain vault queries, owner/agent caps, pagination |

Test cases (intent-parser):

- Parse valid JSON response
- Parse hold action (no params)
- Parse JSON inside markdown code block
- Parse JSON inside plain code block
- Reject invalid action type
- Reject out-of-range confidence / negative confidence
- Reject empty reasoning
- Reject non-numeric amount string
- Reject non-JSON input
- Validate schema directly
- Handle large JSON string (> 10KB)
- Handle Unicode / CJK characters in reasoning
- Take first code block when multiple exist
- Handle JSON with escaped quotes
- Accept boundary confidence values (0 and 1)
- Parse stable_mint action with amount
- Parse stable_burn action (no params)
- Parse stable_claim action (no params)
- Parse swap_usdc_to_sui action
- Reject unknown action type

Test cases (policy-checker):

- Allow valid operation within all limits
- Reject zero amount
- Reject expired policy
- Reject operation during cooldown
- Allow operation after cooldown elapsed
- Skip cooldown check for first transaction
- Reject amount exceeding per-tx limit
- Reject amount exceeding remaining budget
- Reject non-whitelisted action type
- Reject insufficient balance
- Allow non-withdrawal action without amount (stable_burn)
- Allow non-withdrawal action without amount (stable_claim)
- Reject non-whitelisted non-withdrawal action
- Reject expired non-withdrawal action

Test cases (constants):

- suiToMist: 1 SUI, 0 SUI, fractional, large values, sub-MIST precision, negative
- mistToSui: 1e9 MIST, 0 MIST, fractional, very large BigInt, smallest unit

Test cases (ptb-builder):

- buildCreateVault: gas coin, coinObjectId, empty allowedActions, multiple actions, zero deposit
- buildDepositFromGas: valid params, zero amount, large amount
- buildWithdrawAll, buildCreateAgentCap, buildRevokeAgentCap: valid params
- buildAgentWithdraw: valid params, different action types

Test cases (ptb-agent):

- buildAgentCetusSwap: valid swap params, custom slippage
- buildAgentStableMint: valid mint params
- buildAgentStableBurn: valid burn params, burnAll flag
- buildAgentStableClaim: valid claim params

Test cases (service):

- getVault: flat/nested field format, vault not found, missing content, non-moveObject
- getOwnerCaps: empty, string vault_id, nested vault_id, pagination
- getAgentCaps: empty, parse correctly
- getOwnedVaults: empty, via owner caps, skip missing content

### Move Contract Tests (15/15 passing)

```bash
cd contracts
sui move test
```

Tests cover all contract functions and all 9 error code trigger conditions:

- `test_create_vault` -- Vault creation with initial deposit and policy
- `test_deposit` -- Owner deposits additional funds
- `test_withdraw_all` -- Owner withdraws all funds
- `test_create_agent_cap` -- Minting AgentCap to agent address
- `test_agent_withdraw_success` -- Happy-path agent withdrawal
- `test_agent_withdraw_budget_exceeded` -- Total budget enforcement
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

## Code Conventions

### TypeScript

- All monetary amounts use `bigint`, never `number`
- Use `zod` to validate all external inputs (API request bodies, LLM responses)
- Path alias: `@/` maps to project root
- Immutable patterns: no direct state mutation; use spread operator or Zustand `set`
- Error handling: all async functions use try/catch with meaningful error messages
- Unit conversion helpers in `lib/constants.ts`: `suiToMist()`, `mistToSui()`

### Move

- Error code constants: `const E_xxx: u64 = n`
- Use `public(package)` for cross-module internal functions
- Shared objects: `transfer::share_object`
- Owned objects: `transfer::transfer`
- Fund storage: `Balance<SUI>` (not `Coin`)

### Styling

- Tailwind CSS utility classes (no inline styles unless dynamic values)
- Custom design tokens defined in `globals.css` `:root`
- Predefined classes: `glass-card`, `btn-primary`, `btn-ghost`, `vault-input`
- Font hierarchy: Syne (headings) > DM Sans (body) > JetBrains Mono (code/data)

---

## Adding New Features

### Adding a New Policy Rule

1. Add field to `Policy` struct in `contracts/sources/agent_vault.move`
2. Add validation logic in `agent_withdraw` function
3. Add positive and negative tests in `agent_vault_tests.move`
4. Update `Policy` interface in `lib/vault/types.ts`
5. Add corresponding off-chain check in `lib/agent/policy-checker.ts`
6. Add tests in `lib/agent/__tests__/policy-checker.test.ts`
7. Add field parsing in `lib/vault/service.ts` (`parsePolicy`)
8. Add parameter in `lib/vault/ptb-builder.ts` (`buildCreateVault` / `buildUpdatePolicy`)
9. Add UI field in `components/vault/create-vault-form.tsx`

### Adding a New API Route

1. Create `route.ts` under `app/api/`
2. Define Zod schema for request body validation
3. Return `{ success: boolean, data?: T, error?: string }` format
4. Handle all error types (Zod validation errors, runtime errors)

### Adding a New Page

1. Create directory and `page.tsx` under `app/`
2. Use `<Header />` component at page top
3. Add `"use client"` directive if client-side state is needed
4. Use Zustand stores (`useAuthStore`, `useVaultStore`)
5. Use glass-card and other Vault Noir design components

### Adding a New LLM Provider

1. Add API key detection in `lib/agent/llm-client.ts` (`detectProvider`)
2. Implement `callNewProvider()` function following existing pattern
3. Add provider to `MODELS` and `PROVIDER_CALLERS` maps
4. Update `.env.example` with new key variable
5. Update this document's environment variables table

---

## Troubleshooting

### "Missing zkLogin session data"

Ephemeral keypair is stored in `sessionStorage` and is lost when the browser tab closes. Log in again.

### "SPONSOR_PRIVATE_KEY is not set"

Confirm `.env.local` contains `SPONSOR_PRIVATE_KEY` with a valid Sui private key format (`suiprivkey1...`).

### "No LLM API key found"

Set at least one of: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` in `.env.local`.

### "Vault not found: 0x..."

Vault ID may be from a different network (devnet vs testnet). Confirm `NEXT_PUBLIC_SUI_NETWORK` is correct.

### Move contract build fails

Confirm Sui CLI version is compatible with `edition = "2024.beta"`. Check with `sui --version`.

### Cetus swap fails

1. Confirm Cetus Aggregator returns a valid route (`findRouters` returns non-empty `paths`)
2. Confirm slippage tolerance is appropriate (default: 1%)
3. Confirm SUI amount is above minimum required by Cetus routes
4. Check agent logs for "Cetus: no swap route found" error messages

### Stablelayer operation fails

1. Stablelayer is **mainnet-only** -- operations will be skipped on testnet/devnet
2. Confirm the agent address holds LakeUSDC tokens for burn/claim operations
3. Verify the Stablelayer SDK version is compatible (`stable-layer-sdk@2.0.0`)

---

## Related Documentation

- [README.md](../README.md) -- Project overview
- [RUNBOOK.md](./RUNBOOK.md) -- Deployment and operations
- [CLAUDE.md](../CLAUDE.md) -- Claude Code working guidelines
