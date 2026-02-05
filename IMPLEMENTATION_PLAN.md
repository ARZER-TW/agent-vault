# AgentVault Implementation Plan

> HackMoney 2026 (ETHGlobal) - Sui Track
> "Don't give your AI agent the keys. Give it a budget."

## Quick Reference

### Tech Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Sui SDK**: @mysten/sui, @mysten/zklogin, @mysten/deepbook-v3
- **AI**: Claude API (claude-sonnet-4-20250514)
- **Contracts**: Move (Sui Testnet)

### 5-Day Schedule

| Day | Phase | Tasks |
|-----|-------|-------|
| 1 | Move Contracts | Vault + AgentCap + Policy, deploy to Testnet |
| 2 | SDK Integration | DeepBook V3, PTB Builder, Vault Service |
| 3 | Agent Runtime | Policy Checker, Intent Parser, Claude API |
| 4 | Auth + UI | zkLogin, Sponsored TX, Frontend components |
| 5 | Finalize | Testing, Demo video, Documentation, Submit |

---

## Day 1: Move Smart Contracts

### 1.1 Project Initialization

```bash
# Initialize Next.js
npx create-next-app@14 . --typescript --tailwind --app --src-dir=false

# Initialize Move project
cd contracts && sui move new agent_vault

# Install dependencies
pnpm add @mysten/sui @mysten/zklogin @mysten/deepbook-v3 @anthropic-ai/sdk zustand @tanstack/react-query
pnpm add -D vitest @testing-library/react
```

### 1.2 Core Structs (contracts/sources/vault.move)

```move
module agent_vault::vault {
    // === Structs ===

    /// Vault - shared object holding funds
    public struct Vault has key {
        id: UID,
        owner: address,
        balance: Balance<SUI>,
        policy: Policy,
        agent_caps: VecSet<ID>,
        total_spent: u64,
        created_at: u64,
    }

    /// Policy - defines agent operation limits
    public struct Policy has store, copy, drop {
        max_budget: u64,         // max total budget (MIST)
        max_per_tx: u64,         // max per transaction
        allowed_actions: VecSet<String>,
        cooldown_ms: u64,        // cooldown between actions
        expires_at: u64,         // expiry timestamp (ms)
    }

    /// AgentCap - agent's permission token (NFT)
    public struct AgentCap has key, store {
        id: UID,
        vault_id: ID,
        agent_address: address,
        last_action_at: u64,
        total_spent: u64,
    }

    /// OwnerCap - vault owner's permission
    public struct OwnerCap has key, store {
        id: UID,
        vault_id: ID,
    }
}
```

### 1.3 Core Functions

| Function | Caller | Purpose |
|----------|--------|---------|
| `create_vault` | Owner | Create Vault + set Policy + deposit |
| `deposit` | Owner | Add funds to Vault |
| `withdraw` | Owner | Withdraw funds |
| `update_policy` | Owner | Update Policy rules |
| `mint_agent_cap` | Owner | Create AgentCap for agent |
| `revoke_agent_cap` | Owner | Revoke agent permissions |
| `validate_action` | Anyone | Check if action allowed by Policy |
| `withdraw_for_action` | Agent | Execute approved withdrawal |

### 1.4 Deploy

```bash
cd contracts
sui move build
sui move test
sui client publish --gas-budget 100000000
# Record PACKAGE_ID in .env
```

---

## Day 2: DeepBook SDK + PTB Builder

### 2.1 File Structure

```
lib/
├── sui/
│   ├── client.ts       # SuiClient wrapper
│   ├── contracts.ts    # Contract addresses
│   ├── deepbook.ts     # DeepBook V3 client
│   └── market.ts       # Market data service
└── vault/
    ├── types.ts        # TypeScript types
    ├── ptb-builder.ts  # Transaction builder
    └── service.ts      # Vault data queries
```

### 2.2 Key Types (lib/vault/types.ts)

```typescript
interface Policy {
  maxBudget: bigint;
  maxPerTx: bigint;
  allowedActions: string[];
  cooldownMs: number;
  expiresAt: number;
}

interface Vault {
  id: string;
  owner: string;
  balance: bigint;
  policy: Policy;
  agentCaps: string[];
  totalSpent: bigint;
}

interface AgentIntent {
  action: 'swap' | 'transfer';
  amount: bigint;
  params: SwapParams | TransferParams;
}
```

### 2.3 PTB Builder Functions

- `createVault()` - Create new vault
- `deposit()` - Add funds
- `withdraw()` - Remove funds
- `mintAgentCap()` - Create agent permission
- `updatePolicy()` - Modify rules
- `agentSwap()` - Agent swap via DeepBook
- `agentTransfer()` - Agent transfer

---

## Day 3: Agent Runtime + Claude API

### 3.1 File Structure

```
lib/agent/
├── policy-checker.ts   # Policy validation
├── intent-parser.ts    # Parse Claude output
├── claude-client.ts    # Claude API
└── runtime.ts          # Agent main loop
```

### 3.2 Agent Flow

1. Fetch Vault & AgentCap data
2. Get market data (DeepBook)
3. Send to Claude for analysis
4. Parse Claude's decision
5. Check against Policy
6. Build PTB if allowed
7. Execute via Sponsored TX
8. Log results

### 3.3 Claude System Prompt

```
You are an AI trading agent managing a Sui blockchain vault.
Analyze market conditions and make trading decisions within policy constraints.

Response format (JSON):
{
  "action": "swap" | "transfer" | "hold",
  "reasoning": "explanation",
  "confidence": 0.0 to 1.0,
  "params": { "amount": "0.5", "fromToken": "SUI", "toToken": "DBUSDC" }
}
```

---

## Day 4: zkLogin + Sponsored TX + Frontend

### 4.1 zkLogin Flow

1. Generate ephemeral keypair + nonce
2. Redirect to Google OAuth
3. Receive JWT token
4. Get ZK proof from Mysten prover
5. Derive Sui address from JWT

### 4.2 Sponsored TX

- Sponsor signs gas portion
- User signs action portion
- Combined for execution
- User pays zero gas

### 4.3 Frontend Components

```
components/
├── auth/LoginButton.tsx
├── vault/VaultCard.tsx
├── vault/CreateVaultForm.tsx
├── vault/PolicyForm.tsx
└── agent/AgentActivityLog.tsx
```

### 4.4 Pages

```
app/
├── page.tsx              # Landing
├── vault/page.tsx        # Vault list
├── vault/create/page.tsx # Create vault
└── vault/[id]/page.tsx   # Vault details
```

---

## Day 5: Testing + Demo + Submit

### 5.1 Testing Checklist

- [ ] Move contract unit tests
- [ ] Policy checker tests
- [ ] Intent parser tests
- [ ] PTB builder tests
- [ ] E2E flow test

### 5.2 Demo Script (3 min)

| Time | Scene | Content |
|------|-------|---------|
| 0:00-0:20 | Intro | Problem + Solution |
| 0:20-0:35 | Login | zkLogin with Google |
| 0:35-1:05 | Create Vault | Set deposit + policy |
| 1:05-1:25 | Mint AgentCap | Authorize agent |
| 1:25-2:15 | Agent Demo | Market analysis + swap |
| 2:15-2:45 | Policy Enforce | Show rejections |
| 2:45-3:00 | Closing | Summary |

### 5.3 Deliverables

- [ ] Move contracts deployed
- [ ] Frontend on Vercel
- [ ] Demo video < 3 min
- [ ] README with setup instructions
- [ ] HackMoney submission form

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=0x...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
ANTHROPIC_API_KEY=sk-ant-xxx
SPONSOR_PRIVATE_KEY=suiprivkey1...
AGENT_PRIVATE_KEY=suiprivkey1...
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| DeepBook API changes | High | Use official SDK + mock fallback |
| zkLogin prover unstable | Medium | Retry logic + wallet fallback |
| Move contract bugs | Critical | Thorough testing |
| Claude format inconsistent | Low | Robust parsing + fallback |
| Sponsor funds depleted | Medium | Balance monitoring |

---

## Success Criteria

- [ ] Contracts deployed to Testnet
- [ ] zkLogin working
- [ ] Vault CRUD operations
- [ ] AgentCap mint/revoke
- [ ] Policy validation all rules
- [ ] DeepBook swap working
- [ ] Claude agent decisions
- [ ] Sponsored TX zero gas
- [ ] Demo video < 3 min
- [ ] Test coverage > 80%
