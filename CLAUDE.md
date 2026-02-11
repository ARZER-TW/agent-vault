# Suistody - CLAUDE.md

## Repository

https://github.com/ARZER-TW/agent-vault

## 專案快速指引

- 讀取 `README.md` 了解核心目標和架構
- 讀取 `docs/CONTRIB.md` 了解開發流程和測試指南
- 讀取 `docs/RUNBOOK.md` 了解部署和維運

## 專案狀態

所有核心模組已完成實作：

| 模組 | 狀態 | 測試 |
|------|------|------|
| Move 合約 | 已部署 Testnet | 15/15 |
| DeepBook V3 SDK | 完成 | - |
| zkLogin 驗證 | 完成 | - |
| Agent Runtime | 完成 | 20/20 |
| 前端 (Vault Noir) | 完成 | - |
| API Routes | 完成 | - |

## 專案結構

```
contracts/              # Sui Move 智能合約
  sources/agent_vault.move
  tests/agent_vault_tests.move

app/                    # Next.js 14 頁面
  page.tsx              # Landing page
  vault/page.tsx        # Vault 列表
  vault/create/page.tsx # 建立 Vault
  vault/[id]/page.tsx   # Vault 詳情 + Agent 控制
  auth/callback/page.tsx # zkLogin 回調
  api/agent/run/        # Agent 執行 API
  api/vault/[id]/       # Vault 查詢 API

components/             # React 組件
  layout/header.tsx
  auth/login-button.tsx
  vault/vault-card.tsx
  vault/create-vault-form.tsx
  agent/agent-activity-log.tsx

lib/                    # 核心邏輯
  agent/                # AI Agent 相關
    llm-client.ts       # Multi-LLM 整合 (OpenAI/Gemini/Anthropic)
    intent-parser.ts    # Zod 驗證 AI 回應
    policy-checker.ts   # 離線 Policy 預檢
    runtime.ts          # Agent 循環協調器
  auth/                 # 驗證相關
    zklogin.ts          # zkLogin 流程
    sponsored-tx.ts     # Sponsored 交易
  vault/                # Vault 相關
    service.ts          # 鏈上查詢
    ptb-builder.ts      # PTB 構建器 (8 個)
    types.ts            # 型別定義
  sui/                  # Sui SDK
    client.ts           # SuiClient singleton
    deepbook.ts         # DeepBookClient
    market.ts           # 市場數據查詢
    coins.ts            # Coin 物件查詢
  store/                # Zustand 狀態
    auth-store.ts
    vault-store.ts
  constants.ts          # 常數和轉換函數
```

## Git 工作流程

### 必須遵守：每次實作完更動後都要 COMMIT

這是強制規則，不是建議。每完成以下任一項就要 commit + push：
- 完成一個檔案
- 完成一個功能
- 修復一個 bug
- 任何有意義的進度

**不要**累積大量更動才一次 commit。

```bash
# 提交格式
git add <specific-files>
git commit -m "type: 簡短描述"
git push

# type: feat, fix, docs, refactor, test, chore
```

## 開發指令

```bash
# 開發
npm run dev          # 啟動 Next.js dev server
npm run build        # 生產建置
npm run lint         # ESLint 檢查

# 測試
npm test             # 執行所有 vitest 測試 (20/20)
cd contracts && sui move test  # Move 合約測試 (15/15)

# 檢查 SDK 版本
npm ls @mysten/sui   # 必須只有 1.38.0，不能有重複
```

## 開發規則

### SDK 版本相容性 (重要)

- `@mysten/deepbook-v3@0.17.0` 硬性依賴 `@mysten/sui@1.38.0`
- 必須鎖定 `@mysten/sui` 到 `1.38.0`，否則會出現 `experimental_asClientExtension` 型別錯誤
- 安裝新套件後執行 `npm ls @mysten/sui` 檢查是否有重複版本

### DeepBook V3 SDK

- Swap 方法是 **curried**: `dbClient.deepBook.swapExactBaseForQuote(params)(tx)`
- 回傳 `[baseCoinResult, quoteCoinResult, deepCoinResult]`，三個都要 transfer
- 提供 `baseCoin` (TransactionObjectArgument) 時，`amount` 參數會被忽略
- DEEP_SCALAR = 1_000_000 (6 decimals)

### Sui Move 合約

- 使用 `Balance<SUI>` 儲存資金，不是 `Coin`
- AgentCap 必須是 `key, store`（可轉移）
- 共享物件用 `transfer::share_object`
- 錯誤碼使用常數定義 `const E_xxx: u64 = n`
- 溢出防護：用減法 `amount <= max - spent` 而非加法 `spent + amount <= max`

### TypeScript

- 金額單位：合約用 MIST (1 SUI = 1e9 MIST)
- BigInt 處理所有金額，避免精度問題
- BigInt literal 需要 `"target": "ES2020"` 在 tsconfig.json
- PTB 構建後必須設置 gas budget
- 使用 zod 驗證所有外部輸入

### @mysten/sui API

- `SuiClient.getObject({ id, options: { showContent: true } })` 取得 Move struct fields
- `SuiClient.getOwnedObjects({ owner, filter: { StructType: "pkg::mod::Type" } })`
- Move struct fields 巢狀: `content.fields.field_name` 或 `content.fields.fields.field_name`
- `Balance<SUI>` 巢狀: `balance_sui.fields.value` 或 `balance_sui.value`

### zkLogin

- 整合在 `@mysten/sui/zklogin`（不是獨立的 `@mysten/zklogin`）
- 流程: Ed25519Keypair.generate() -> generateNonce(pk, maxEpoch, randomness) -> OAuth -> ZK proof -> getZkLoginSignature
- Prover URL: testnet=`prover-dev.mystenlabs.com/v1`, mainnet=`prover.mystenlabs.com/v1`

### 前端設計系統 (Vault Noir)

- 字體: Syne (display), DM Sans (body), JetBrains Mono (mono)
- 色彩: void=#060a13, deep=#0a0e1a, accent=#00d4ff, amber=#f59e0b
- CSS 類別: `glass-card`, `glow-border`, `gradient-text`, `btn-primary`, `btn-ghost`
- 動畫: `animate-fade-in-up`, `stagger-children`, `animate-pulse-glow`
- 使用 CSS 變數 `var(--color-xxx)` 維持一致性

## 關鍵常數

```typescript
// Sui 系統物件
const CLOCK_OBJECT_ID = '0x6';

// 網路配置
const TESTNET_RPC = 'https://fullnode.testnet.sui.io:443';
const ZKLOGIN_PROVER = 'https://prover-dev.mystenlabs.com/v1';

// DeepBook V3
const SUI_DBUSDC_POOL = 'SUI_DBUSDC';  // Pool key
```

## 禁止事項

- 不要在前端暴露私鑰
- 不要硬編碼 Package ID（用環境變數）
- 不要跳過 Policy 檢查直接執行交易
- 不要在 Move 合約中使用 `transfer::transfer` 轉移共享物件
- 不要忘記處理 DEEP token 費用
- 不要升級 `@mysten/sui` 超過 `1.38.0`（會破壞 DeepBook 相容性）

## 常見問題

### DeepBook swap 失敗
- 檢查是否有足夠的 DEEP token
- 檢查 minOut 是否設置過高
- 確認 pool 有足夠流動性

### zkLogin 地址不一致
- 確保使用相同的 salt
- 確保 JWT 的 sub claim 沒有變化

### Policy 驗證失敗
- 檢查時間戳是否使用毫秒
- 確認 cooldown 計算正確
- 驗證 AgentCap ID 在 Vault 的授權列表中

### Build 失敗：experimental_asClientExtension
- 原因：`@mysten/sui` 版本不匹配
- 修復：`npm install @mysten/sui@1.38.0`
- 驗證：`npm ls @mysten/sui` 應只顯示一個 1.38.0
