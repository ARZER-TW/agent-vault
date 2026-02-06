# AgentVault -- Development Guide

> 開發工作流程、測試程序、環境設定指南

**Last Updated:** 2026-02-06

---

## Prerequisites

| Tool       | Version  | Purpose                          | Install                                |
|------------|----------|----------------------------------|----------------------------------------|
| Node.js    | >= 18    | JavaScript runtime               | https://nodejs.org/                    |
| pnpm       | >= 8     | Package manager (推薦)           | `npm install -g pnpm`                  |
| Sui CLI    | latest   | Move 合約編譯/部署/測試          | https://docs.sui.io/build/install      |
| TypeScript | >= 5     | 型別檢查 (included in devDeps)   | Installed via pnpm                     |

### Optional

| Tool              | Purpose                                     |
|-------------------|---------------------------------------------|
| Google Cloud Console | 建立 OAuth Client ID (zkLogin 用)        |
| Anthropic Console | 取得 Claude API Key                         |
| Sui Testnet Faucet | 為 Sponsor/Agent 錢包取得測試 SUI          |

---

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/ARZER-TW/agent-vault.git
cd agent-vault
pnpm install
```

### 2. Environment Variables

```bash
cp .env.example .env.local
```

必要環境變數：

| Variable                        | Required | Description                                   |
|---------------------------------|----------|-----------------------------------------------|
| `NEXT_PUBLIC_SUI_NETWORK`       | Yes      | `testnet` (default) or `mainnet`              |
| `NEXT_PUBLIC_PACKAGE_ID`        | Yes      | 部署後的合約 Package ID                      |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`  | Yes      | Google OAuth Client ID                        |
| `GOOGLE_CLIENT_SECRET`          | Yes      | Google OAuth Client Secret                    |
| `NEXT_PUBLIC_REDIRECT_URI`      | Yes      | OAuth callback URL                            |
| `ANTHROPIC_API_KEY`             | Yes      | Claude API key (`sk-ant-...`)                 |
| `SPONSOR_PRIVATE_KEY`           | Yes      | Sponsor 錢包私鑰 (代付 gas 用)               |
| `AGENT_PRIVATE_KEY`             | Yes      | Agent 錢包私鑰 (執行交易用)                  |

**安全注意**: `.env.local` 已在 `.gitignore` 中，絕對不要 commit 私鑰。

### 3. 取得 Testnet SUI

Sponsor 和 Agent 錢包需要 testnet SUI。使用 faucet：

```bash
# 生成新的 keypair
sui keytool generate ed25519

# 用 Sui CLI 領取 testnet SUI
sui client faucet --address <YOUR_ADDRESS>
```

### 4. Google OAuth 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 建立 OAuth 2.0 Client ID (Web application)
3. 添加授權的重新導向 URI：`http://localhost:3000/auth/callback`
4. 複製 Client ID 和 Secret 到 `.env.local`

---

## Development Workflow

### Available Scripts

| Command             | Description                         |
|---------------------|-------------------------------------|
| `pnpm dev`          | 啟動開發伺服器 (http://localhost:3000) |
| `pnpm build`        | 建置 production bundle              |
| `pnpm start`        | 啟動 production 伺服器              |
| `pnpm lint`         | ESLint 檢查                         |
| `pnpm vitest run`   | 執行所有 TypeScript 單元測試        |
| `pnpm vitest`       | Watch mode 執行測試                 |

### Move Contract Commands

```bash
cd contracts

# 編譯
sui move build

# 測試 (15 tests)
sui move test

# 部署到 Testnet
sui client publish --gas-budget 100000000

# 部署後記錄 Package ID 到 .env.local
```

### Git Workflow

**強制規則**：每完成一個功能或檔案就要 commit + push。

```bash
# Commit 格式
git add <specific-files>
git commit -m "type: description"
git push

# type 類型：
# feat     - 新功能
# fix      - 修復 bug
# docs     - 文件更新
# refactor - 重構
# test     - 測試
# chore    - 維護工作
```

**不要**累積大量更動才一次 commit。

---

## Project Architecture

### Module Dependencies

```
app/ (pages + API routes)
  |
  +-- components/ (React UI)
  |     |
  +-- lib/store/ (Zustand state)
  |     |
  +-- lib/agent/ (AI runtime)
  |     |     |
  |     |     +-- lib/vault/service.ts (on-chain queries)
  |     |     +-- lib/sui/market.ts (DeepBook data)
  |     |     +-- Claude API (external)
  |     |
  +-- lib/vault/ptb-builder.ts (transaction construction)
  |     |
  +-- lib/auth/ (zkLogin + sponsored tx)
  |     |
  +-- lib/sui/ (Sui/DeepBook clients)
  |     |
  +-- lib/constants.ts (shared config)
```

### Key Design Decisions

1. **Balance<SUI> not Coin** -- 合約使用 `Balance<SUI>` 儲存資金，效能更好
2. **AgentCap as key, store** -- 讓 AgentCap 可轉移給不同地址
3. **Shared Vault object** -- 使用 `transfer::share_object` 讓任何人可讀取
4. **Off-chain policy pre-check** -- 在 `policy-checker.ts` 先驗證，避免浪費 gas
5. **BigInt for amounts** -- TypeScript 端所有金額使用 `bigint` 避免精度問題
6. **MIST as unit** -- 合約內部統一使用 MIST (1 SUI = 1,000,000,000 MIST)

---

## Testing

### TypeScript Tests (Vitest)

```bash
# 執行所有測試
pnpm vitest run

# Watch mode
pnpm vitest

# 執行特定測試檔
pnpm vitest run lib/agent/__tests__/policy-checker.test.ts
```

目前的測試覆蓋範圍：

| Test File                   | Tests | Coverage Area                            |
|-----------------------------|-------|------------------------------------------|
| `intent-parser.test.ts`     | 9     | JSON 解析、Zod 驗證、code block 處理    |
| `policy-checker.test.ts`    | 11    | 所有 6 個 policy 規則的邊界條件          |

測試案例清單 (intent-parser):

- 解析有效 JSON response
- 解析 hold action (無 params)
- 解析 markdown code block 中的 JSON
- 解析 plain code block 中的 JSON
- 拒絕無效 action type
- 拒絕超出範圍的 confidence
- 拒絕空的 reasoning
- 拒絕非數字的 amount string
- 拒絕非 JSON 輸入

測試案例清單 (policy-checker):

- 允許在所有限制內的有效操作
- 拒絕零金額
- 拒絕已過期的 policy
- 拒絕在 cooldown 期間的操作
- 允許 cooldown 結束後的操作
- 跳過第一筆交易的 cooldown 檢查
- 拒絕超過 per-tx 限制的金額
- 拒絕超過剩餘預算的金額
- 拒絕非白名單的 action type
- 拒絕餘額不足

### Move Contract Tests

```bash
cd contracts
sui move test
```

15 個測試涵蓋所有合約功能和 9 個錯誤碼的觸發條件。

---

## Code Conventions

### TypeScript

- 所有金額使用 `bigint`，不使用 `number`
- 使用 `zod` 驗證所有外部輸入 (API request bodies, Claude responses)
- 路徑別名：`@/` 對應專案根目錄
- Immutable patterns：不直接修改 state，使用展開運算子或 Zustand set
- 錯誤處理：所有 async 函式使用 try/catch，提供有意義的錯誤訊息

### Move

- 錯誤碼常數定義：`const E_xxx: u64 = n`
- 使用 `public(package)` 限制跨模組內部函式
- Shared objects 使用 `transfer::share_object`
- Owned objects 使用 `transfer::transfer`

### Styling

- Tailwind CSS utility classes (no inline styles unless dynamic)
- 自定義設計 token 在 `globals.css` :root 中定義
- 使用 `glass-card`, `btn-primary`, `btn-ghost` 等預定義 class
- Font hierarchy: Syne (headings) > DM Sans (body) > JetBrains Mono (code/data)

---

## Adding New Features

### Adding a New Policy Rule

1. 在 `contracts/sources/agent_vault.move` 的 `Policy` struct 添加欄位
2. 在 `agent_withdraw` 函式中添加驗證邏輯
3. 在 `agent_vault_tests.move` 添加正面和負面測試
4. 在 `lib/vault/types.ts` 更新 `Policy` interface
5. 在 `lib/agent/policy-checker.ts` 添加對應的 off-chain 檢查
6. 在 `lib/agent/__tests__/policy-checker.test.ts` 添加測試
7. 在 `lib/vault/service.ts` 的 `parsePolicy` 中添加欄位解析
8. 在 `lib/vault/ptb-builder.ts` 的 `buildCreateVault` / `buildUpdatePolicy` 中添加參數
9. 在 `components/vault/create-vault-form.tsx` 添加 UI 欄位

### Adding a New API Route

1. 在 `app/api/` 下建立 `route.ts`
2. 使用 Zod schema 驗證 request body
3. 返回 `{ success: boolean, data?: T, error?: string }` 格式
4. 處理所有錯誤（Zod validation、runtime errors）

### Adding a New Page

1. 在 `app/` 下建立資料夾和 `page.tsx`
2. 使用 `<Header />` 元件作為頁面頂部
3. 如果需要 client-side state，加上 `"use client"` 指令
4. 使用 Zustand stores (`useAuthStore`, `useVaultStore`)
5. 使用 glass-card 和其他 Vault Noir 設計元件

---

## Troubleshooting

### "Missing zkLogin session data"

ephemeral keypair 儲存在 `sessionStorage`，關閉瀏覽器分頁後會遺失。重新登入即可。

### "SPONSOR_PRIVATE_KEY is not set"

確認 `.env.local` 中有設定 `SPONSOR_PRIVATE_KEY`，且是有效的 Sui 私鑰格式 (`suiprivkey1...`)。

### "Vault not found: 0x..."

Vault ID 可能來自不同的 network（devnet vs testnet）。確認 `NEXT_PUBLIC_SUI_NETWORK` 設定正確。

### Move contract build fails

確認 Sui CLI 版本與合約的 `edition = "2024.beta"` 相容。使用 `sui --version` 檢查。

### DeepBook swap fails

1. 確認 Agent 地址持有少量 DEEP token
2. 確認 `minOut` 沒有設置過高
3. 確認 Testnet pool 有足夠流動性（可能需要自己掛單）

---

## Related Documentation

- [README.md](../README.md) -- 專案總覽
- [TECH_SPEC.md](../TECH_SPEC.md) -- 完整技術規格
- [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) -- 實作計畫
- [RUNBOOK.md](./RUNBOOK.md) -- 部署與維運
- [CLAUDE.md](../CLAUDE.md) -- Claude Code 工作指引
