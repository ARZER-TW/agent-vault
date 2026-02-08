# Suistody -- Runbook

> 部署程序、常見問題修復、維運指南

**Last Updated:** 2026-02-09

---

## Deployment

### Move Contract Deployment

Contract is deployed to Sui Testnet. To redeploy:

```bash
cd contracts

# 1. Verify all tests pass
sui move test

# 2. Deploy to Testnet
sui client publish --gas-budget 100000000

# 3. Get Package ID from output
# Look for "Published Objects" section -> packageId

# 4. Update environment variables
# .env.local:
# NEXT_PUBLIC_PACKAGE_ID=0x<new-package-id>
# Also update the comment in .env.example
```

**Important:**
- Each publish produces a new Package ID
- All previously created Vaults and AgentCaps only work with their original Package ID
- New deployment = fresh start; old data is not migratable

### Current Deployment Info

| Item        | Value                                                              |
|-------------|--------------------------------------------------------------------|
| Network     | Sui Testnet                                                        |
| Package ID  | `0xf01673d606536731ca79fe85324026cdf9c7b2471bbf61a29b03ce911fe5c7d1` |
| Module      | `agent_vault`                                                      |
| Edition     | 2024.beta                                                          |

### Frontend Deployment (Vercel)

**Live URL:** [https://agent-vault-dusky.vercel.app](https://agent-vault-dusky.vercel.app)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Set environment variables
# In Vercel Dashboard -> Settings -> Environment Variables:
# - NEXT_PUBLIC_SUI_NETWORK
# - NEXT_PUBLIC_PACKAGE_ID
# - NEXT_PUBLIC_GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - NEXT_PUBLIC_REDIRECT_URI  (change to production URL)
# - NEXT_PUBLIC_ENOKI_API_KEY
# - OPENAI_API_KEY (or GEMINI_API_KEY or ANTHROPIC_API_KEY)
# - SPONSOR_PRIVATE_KEY
# - AGENT_PRIVATE_KEY
```

**Note**: After deploying to production, add the production callback URL in Google Cloud Console.

### Build Verification

```bash
# Local build verification
npm run build

# Verify no TypeScript errors
# Verify all pages generate correctly
```

---

## Wallet Management

### Sponsor Wallet

The sponsor wallet pays gas for all user and agent transactions.

**Monitor balance:**
```bash
sui client gas --address <SPONSOR_ADDRESS>
```

**Fund wallet:**
```bash
# Testnet: use faucet
sui client faucet --address <SPONSOR_ADDRESS>

# Each faucet call provides approximately 1 SUI
# Maintain at least 5 SUI balance
```

**Alert thresholds:**
- Below 2 SUI: refund needed
- Below 0.5 SUI: urgent (transactions will start failing)

**Check sponsor address from running app:**
```bash
curl http://localhost:3000/api/sponsor/address
```

### Agent Wallet

The agent wallet executes AI-driven trades.

**Required holdings:**
- Small amount of SUI (gas; usually covered by sponsor)
- Small amount of DEEP token (DeepBook V3 trading fees)

**Get DEEP tokens on Testnet:**
- Swap using DEEP/SUI whitelisted pool (0% fee)
- Or use DEEP testnet faucet (if available)

**Check agent address from running app:**
```bash
curl http://localhost:3000/api/agent/address
```

**Check agent wallet objects:**
```bash
sui client objects --address <AGENT_ADDRESS>
```

---

## Common Issues and Fixes

### Issue: zkLogin "ZK prover error"

**Symptoms:** User sees "ZK prover error" on the callback page after Google login

**Possible causes:**
1. Mysten Enoki API service temporarily unavailable
2. Ephemeral keypair expired (maxEpoch has passed)
3. JWT token invalid or expired
4. ENOKI_API_KEY missing or invalid

**Fix:**
1. Wait a few minutes and retry (Enoki service may be in maintenance)
2. Clear browser `sessionStorage` and log in again
3. Verify Google OAuth Client ID is correct
4. Verify `NEXT_PUBLIC_ENOKI_API_KEY` is set in `.env.local`

### Issue: "No LLM API key found"

**Symptoms:** Agent run fails with "No LLM API key found. Set one of: OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY"

**Fix:**
1. Set at least one LLM API key in `.env.local`
2. Restart the dev server after changing `.env.local`
3. Optionally set `LLM_PROVIDER` to force a specific provider

### Issue: "Vault not found"

**Symptoms:** API or frontend page reports vault not found

**Possible causes:**
1. Vault ID is from a different network
2. Package ID mismatch (vault was created with a different contract)
3. Vault ID format is incorrect

**Fix:**
1. Confirm `NEXT_PUBLIC_SUI_NETWORK` matches the vault's network
2. Confirm `NEXT_PUBLIC_PACKAGE_ID` matches the package used to create the vault
3. Verify object ID exists on [Sui Explorer](https://suiscan.xyz/testnet)

### Issue: DeepBook Swap Fails

**Symptoms:** Agent swap transaction fails on-chain

**Possible causes:**
1. Insufficient DEEP tokens (trading fee)
2. `minOut` set too high (slippage protection triggered)
3. Pool has insufficient liquidity
4. Coin object already consumed (gas coin conflict)

**Fix:**
1. Verify Agent address holds DEEP tokens:
   ```bash
   sui client objects --address <AGENT_ADDRESS>
   ```
2. Lower `minOut` value (or set to 0 for testing)
3. Place counterparty orders on DeepBook to add liquidity
4. Ensure PTB does not reuse the same coin object
5. Run diagnostics: `npx tsx scripts/test-deepbook.ts`

### Issue: Policy Check Fails On-Chain but Passes Off-Chain

**Symptoms:** `policy-checker.ts` passes but on-chain transaction aborts

**Possible causes:**
1. Time difference between off-chain check and on-chain execution
2. Concurrent transaction modified vault state after off-chain check
3. Clock timestamp discrepancy

**Fix:**
1. Add safety margin to off-chain checks (e.g., extra 5 seconds for cooldown)
2. Re-fetch vault state after transaction failure, then retry
3. Use `Date.now()` consistently as the time source

### Issue: Sponsored TX Signature Invalid

**Symptoms:** `executeTransactionBlock` returns signature error

**Possible causes:**
1. Sponsor keypair does not match gas owner address
2. Transaction bytes were modified after signing
3. zkLogin signature's maxEpoch has expired

**Fix:**
1. Verify `SPONSOR_PRIVATE_KEY` derives the same address used in `setGasOwner`
2. Ensure transaction is not modified after `build()`
3. Log in again to refresh ephemeral keypair and maxEpoch

### Issue: LLM Returns Invalid JSON

**Symptoms:** `parseAgentDecision` throws a parse error

**Possible causes:**
1. LLM returned non-JSON content (explanation text, etc.)
2. LLM returned JSON that doesn't match the Zod schema
3. Rate limiting or API error from the provider

**Fix:**
1. Intent parser already supports markdown code block extraction (```json blocks)
2. Verify system prompt explicitly requests JSON-only response
3. Check API key balance and rate limits at the provider's console
4. Try switching to a different LLM provider via `LLM_PROVIDER` env var

### Issue: Agent TX Fails with "Transaction execution failed"

**Symptoms:** Both sponsored and direct execution fail

**Fix:**
1. Check the detailed error message (it includes both sponsored and direct errors)
2. Verify on-chain vault state matches expectations:
   ```bash
   curl http://localhost:3000/api/vault/<VAULT_ID>
   ```
3. Verify AgentCap is still authorized (not revoked)
4. Verify vault policy has not expired
5. Check if cooldown period has elapsed since last transaction

---

## Move Contract Error Code Reference

| Code | Constant                | Trigger Condition                          |
|------|-------------------------|--------------------------------------------|
| 0    | `E_NOT_OWNER`           | OwnerCap vault_id does not match Vault     |
| 1    | `E_BUDGET_EXCEEDED`     | total_spent + amount > max_budget          |
| 2    | `E_NOT_WHITELISTED`     | Action type not in allowed_actions list    |
| 3    | `E_EXPIRED`             | Current time >= expires_at                 |
| 4    | `E_COOLDOWN`            | Time since last tx < cooldown_ms           |
| 5    | `E_INVALID_CAP`         | AgentCap not authorized or wrong vault     |
| 6    | `E_INSUFFICIENT_BALANCE`| Vault balance < requested amount           |
| 7    | `E_PER_TX_EXCEEDED`     | amount > max_per_tx                        |
| 8    | `E_ZERO_AMOUNT`         | amount == 0                                |

---

## Rollback Procedures

### Frontend Rollback (Vercel)

```bash
# List recent deployments
vercel ls

# Roll back to a specific deployment
vercel rollback <deployment-url>
```

Or in Vercel Dashboard -> Deployments, select an older version to redeploy.

### Contract Rollback

**Move contracts cannot be rolled back.** If a new contract version has issues:

1. Stop using the new Package ID (point frontend to old Package ID)
2. If a fix is needed, publish a corrected version (new Package ID)
3. All existing Vaults only work with the Package ID they were created under

### Data Recovery

Vault funds are on-chain and always safe:

1. **Owner can always withdraw**: Use `withdraw_all` function
2. **AgentCap can always be revoked**: Use `revoke_agent_cap` function
3. **Funds don't depend on frontend**: Even if frontend is offline, use Sui CLI to call the contract directly

Manual fund withdrawal (no frontend needed):

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module agent_vault \
  --function withdraw_all \
  --args <VAULT_ID> <OWNER_CAP_ID> \
  --gas-budget 10000000
```

---

## Monitoring Checklists

### Daily

- [ ] Sponsor wallet balance > 2 SUI
- [ ] Agent wallet holds DEEP tokens
- [ ] Frontend is accessible
- [ ] zkLogin Enoki service is available

### Before Demo

- [ ] All tests pass (`npm test` + `cd contracts && sui move test`)
- [ ] Frontend build succeeds (`npm run build`)
- [ ] Pre-login with zkLogin (avoid waiting for ZK prover on stage)
- [ ] Verify Testnet pool has liquidity (`npx tsx scripts/test-deepbook.ts`)
- [ ] Sponsor wallet balance sufficient (> 5 SUI)
- [ ] DEEP token balance sufficient
- [ ] Prepare fallback market data (in case DeepBook is unavailable)
- [ ] Test Demo Mode panel with "Test Over-Limit" and "Test Normal" buttons
- [ ] Test Guardrail Stress Test panel (all 5 tests should show BLOCKED)

### Security

- [ ] `.env.local` is NOT committed
- [ ] No private keys in frontend code
- [ ] All API routes have input validation (Zod)
- [ ] Error messages do not leak sensitive information
- [ ] `SPONSOR_PRIVATE_KEY` and `AGENT_PRIVATE_KEY` are not exposed to client

---

## Key Constants Reference

```typescript
// Sui System
const CLOCK_OBJECT_ID = '0x6';

// Network
const TESTNET_RPC = 'https://fullnode.testnet.sui.io:443';

// Enoki ZK Prover
const ENOKI_URL = 'https://api.enoki.mystenlabs.com/v1/zklogin/zkp';

// DeepBook V3
const DEEPBOOK_POOL_KEY = 'SUI_DBUSDC';

// Unit Conversion
// 1 SUI = 1,000,000,000 MIST (1e9)
// DBUSDC uses 6 decimals (1e6)

// Action Types (matching Move contract)
const ACTION_SWAP = 0;
const ACTION_LIMIT_ORDER = 1;
```

---

## Related Documentation

- [README.md](../README.md) -- Project overview
- [CONTRIB.md](./CONTRIB.md) -- Development workflow
- [CLAUDE.md](../CLAUDE.md) -- Claude Code working guidelines
