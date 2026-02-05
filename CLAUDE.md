# AgentVault - CLAUDE.md

## Repository

https://github.com/ARZER-TW/agent-vault

## 專案快速指引

- 讀取 `TECH_SPEC.md` 了解核心目標和設計理念
- 讀取 `IMPLEMENTATION_PLAN.md` 了解實作細節和每日任務

## Git 工作流程

**重要**：每完成一個功能或階段就要 commit，保持小而頻繁的提交。

```bash
# 提交格式
git add <specific-files>
git commit -m "feat: 簡短描述"
git push
```

## 開發規則

### Sui Move 合約
- 使用 `Balance<SUI>` 儲存資金，不是 `Coin`
- AgentCap 必須是 `key, store`（可轉移）
- 共享物件用 `transfer::share_object`
- 錯誤碼使用常數定義 `const E_xxx: u64 = n`
- `public(package)` 用於跨模組內部函數

### TypeScript
- 金額單位：合約用 MIST (1 SUI = 1e9 MIST)
- BigInt 處理所有金額，避免精度問題
- PTB 構建後必須設置 gas budget
- 使用 zod 驗證所有外部輸入

### 測試
- Move 合約：`sui move test`
- 前端：`pnpm test`
- 部署前必須通過所有測試

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
