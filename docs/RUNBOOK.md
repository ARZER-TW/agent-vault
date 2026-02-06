# AgentVault -- Runbook

> 部署程序、常見問題修復、維運指南

**Last Updated:** 2026-02-06

---

## Deployment

### Move Contract Deployment

合約已部署到 Sui Testnet。如需重新部署：

```bash
cd contracts

# 1. 確認所有測試通過
sui move test

# 2. 部署到 Testnet
sui client publish --gas-budget 100000000

# 3. 從輸出中取得 Package ID
# 搜尋 "Published Objects" 區塊中的 packageId

# 4. 更新環境變數
# .env.local:
# NEXT_PUBLIC_PACKAGE_ID=0x<new-package-id>
# 同時更新 .env.example 中的註釋
```

**注意事項:**
- 每次 publish 會產生新的 Package ID
- 所有先前建立的 Vault 和 AgentCap 只能配合舊 Package ID 使用
- 新部署 = 全新開始，舊資料不可遷移

### 目前部署資訊

| Item        | Value                                                              |
|-------------|--------------------------------------------------------------------|
| Network     | Sui Testnet                                                        |
| Package ID  | `0xbf74c7a7717e74f5074d024e27a5f6d2838d5025e4c67afd758286e3ba6bb31b` |
| Module      | `agent_vault`                                                      |
| Edition     | 2024.beta                                                          |

### Frontend Deployment (Vercel)

```bash
# 1. 安裝 Vercel CLI
npm install -g vercel

# 2. 部署
vercel

# 3. 設定環境變數
# 在 Vercel Dashboard -> Settings -> Environment Variables 中設定：
# - NEXT_PUBLIC_SUI_NETWORK
# - NEXT_PUBLIC_PACKAGE_ID
# - NEXT_PUBLIC_GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - NEXT_PUBLIC_REDIRECT_URI  (改為 production URL)
# - ANTHROPIC_API_KEY
# - SPONSOR_PRIVATE_KEY
# - AGENT_PRIVATE_KEY
```

**注意**: 部署到 production 後，需要在 Google Cloud Console 中添加 production 的 callback URL。

### Build Verification

```bash
# 本地 build 驗證
pnpm build

# 確認沒有 TypeScript 錯誤
# 確認所有頁面正常生成
```

---

## Wallet Management

### Sponsor Wallet

Sponsor 錢包負責為所有用戶交易代付 gas。

**監控:**
```bash
# 查看 Sponsor 錢包餘額
sui client gas --address <SPONSOR_ADDRESS>
```

**充值:**
```bash
# Testnet: 使用 faucet
sui client faucet --address <SPONSOR_ADDRESS>

# 每次 faucet 約提供 1 SUI
# 建議保持至少 5 SUI 的餘額
```

**告警閾值:**
- 低於 2 SUI: 需要充值
- 低於 0.5 SUI: 緊急充值（交易可能開始失敗）

### Agent Wallet

Agent 錢包用於執行 AI 交易。

**需要持有:**
- 少量 SUI (gas，但通常由 sponsor 支付)
- 少量 DEEP token (DeepBook V3 手續費)

**取得 DEEP token (Testnet):**
- 使用 DEEP/SUI 白名單池（0% 手續費）交換取得
- 或使用 DEEP testnet faucet (如果可用)

---

## Common Issues and Fixes

### Issue: zkLogin "ZK prover error"

**症狀:** 使用者登入後在 callback 頁面看到 "ZK prover error" 訊息

**可能原因:**
1. Mysten ZK Prover 服務暫時不可用
2. Ephemeral keypair 過期 (maxEpoch 已過)
3. JWT token 無效或已過期

**修復:**
1. 等待幾分鐘後重試（Prover 服務可能在維護）
2. 清除瀏覽器 sessionStorage 後重新登入
3. 檢查 Google OAuth Client ID 設定是否正確

### Issue: "Vault not found"

**症狀:** API 或前端頁面報告 vault 找不到

**可能原因:**
1. Vault ID 來自不同 network
2. Package ID 不匹配（舊合約的 Vault）
3. Vault ID 格式錯誤

**修復:**
1. 確認 `NEXT_PUBLIC_SUI_NETWORK` 與 vault 所在的 network 一致
2. 確認 `NEXT_PUBLIC_PACKAGE_ID` 與建立 vault 時的 package 一致
3. 在 Sui Explorer 上驗證 object ID 是否存在

### Issue: DeepBook Swap Fails

**症狀:** Agent 嘗試 swap 時交易失敗

**可能原因:**
1. DEEP token 不足（手續費）
2. minOut 設置過高（滑點保護觸發）
3. Pool 流動性不足
4. Coin object 已被使用（gas coin 衝突）

**修復:**
1. 確認 Agent 地址持有 DEEP token:
   ```bash
   sui client objects --address <AGENT_ADDRESS>
   ```
2. 降低 minOut 值（或設為 0 用於測試）
3. 在 DeepBook 掛對手單增加流動性
4. 確保 PTB 中沒有重複使用同一個 coin object

### Issue: Policy Check Fails on-chain but passes off-chain

**症狀:** `policy-checker.ts` 通過但鏈上交易被 abort

**可能原因:**
1. 時間差：off-chain 檢查和鏈上執行之間的延遲
2. 並發交易：另一筆交易在 off-chain 檢查後修改了 vault 狀態
3. Clock timestamp 差異

**修復:**
1. off-chain 檢查時加入安全邊際（例如 cooldown 多加 5 秒）
2. 在交易失敗後重新查詢 vault 狀態再重試
3. 使用 `Date.now()` 而非其他時間來源

### Issue: Sponsored TX Signature Invalid

**症狀:** `executeTransactionBlock` 返回簽名錯誤

**可能原因:**
1. Sponsor keypair 與 gas owner 地址不匹配
2. Transaction bytes 在簽名後被修改
3. zkLogin signature 中的 maxEpoch 已過期

**修復:**
1. 確認 `SPONSOR_PRIVATE_KEY` 對應的地址與 `setGasOwner` 一致
2. 確保在 `build()` 之後不再修改 transaction
3. 重新登入以刷新 ephemeral keypair 和 maxEpoch

### Issue: Claude API Returns Invalid JSON

**症狀:** `parseAgentDecision` 拋出解析錯誤

**可能原因:**
1. Claude 返回了 JSON 以外的內容
2. Claude 返回了不符合 schema 的 JSON
3. Rate limiting 或 API 錯誤

**修復:**
1. Intent parser 已支援 markdown code block 提取（```json blocks）
2. 確認 system prompt 明確要求 JSON-only 回應
3. 檢查 Anthropic API key 餘額和 rate limits

---

## Rollback Procedures

### Frontend Rollback (Vercel)

```bash
# 列出近期部署
vercel ls

# 回滾到指定部署
vercel rollback <deployment-url>
```

或在 Vercel Dashboard -> Deployments 中選擇舊版本重新部署。

### Contract Rollback

**Move 合約無法回滾。** 如果新版合約有問題：

1. 停止使用新 Package ID（將前端指向舊 Package ID）
2. 如果需要修復，publish 修正版本（新 Package ID）
3. 所有舊 Vault 只能配合建立時的 Package ID 使用

### Data Recovery

Vault 資金在鏈上，永遠安全：

1. **Owner 可隨時提取**: 使用 `withdraw_all` 函式
2. **AgentCap 可隨時撤銷**: 使用 `revoke_agent_cap` 函式
3. **資金不依賴前端**: 即使前端離線，可使用 Sui CLI 直接呼叫合約

手動提取資金（無需前端）:

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module agent_vault \
  --function withdraw_all \
  --args <VAULT_ID> <OWNER_CAP_ID> \
  --gas-budget 10000000
```

---

## Monitoring Checklist

### Daily

- [ ] Sponsor 錢包餘額 > 2 SUI
- [ ] Agent 錢包持有 DEEP token
- [ ] Frontend 可正常訪問
- [ ] zkLogin prover 服務可用

### Before Demo

- [ ] 所有測試通過 (`pnpm vitest run` + `sui move test`)
- [ ] Frontend build 成功 (`pnpm build`)
- [ ] 預先登入 zkLogin（避免現場等待 ZK prover）
- [ ] 確認 Testnet pool 有流動性
- [ ] Sponsor 錢包餘額充足（> 5 SUI）
- [ ] DEEP token 餘額足夠
- [ ] 準備好備用市場數據（以防 DeepBook 異常）

### Security

- [ ] `.env.local` 沒有被 commit
- [ ] 私鑰沒有出現在前端程式碼中
- [ ] API routes 有 input validation (Zod)
- [ ] 錯誤訊息不洩漏敏感資訊

---

## Key Constants Reference

```typescript
// Sui System
const CLOCK_OBJECT_ID = '0x6';

// Network
const TESTNET_RPC = 'https://fullnode.testnet.sui.io:443';
const ZKLOGIN_PROVER = 'https://prover-dev.mystenlabs.com/v1';

// DeepBook V3
const SUI_DBUSDC_POOL = 'SUI_DBUSDC';

// Unit Conversion
// 1 SUI = 1,000,000,000 MIST (1e9)
// DBUSDC uses 6 decimals (1e6)

// Action Types (matching Move contract)
const ACTION_SWAP = 0;
const ACTION_LIMIT_ORDER = 1;
```

---

## Related Documentation

- [README.md](../README.md) -- 專案總覽
- [CONTRIB.md](./CONTRIB.md) -- 開發工作流程
- [TECH_SPEC.md](../TECH_SPEC.md) -- 完整技術規格
- [CLAUDE.md](../CLAUDE.md) -- Claude Code 工作指引
