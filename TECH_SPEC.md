# AgentVault Technical Specification

> Policy-Based AI Agent Wallet on Sui
> HackMoney 2026 (ETHGlobal) — Sui Track
> Last Updated: 2026-02-05

---

## 一、專案總覽 (Project Overview)

### 1.1 One-Line Pitch

**"Don't give your AI agent the keys. Give it a budget."**

### 1.2 問題與解決方案

#### 背景脈絡

2025–2026 年，AI Agent 經濟正在快速崛起。從 Google 的 Agentic Payment Protocol (AP2)、Stripe 的 Agent Toolkit，到 Anthropic 的 MCP 和 OpenAI 的 Function Calling，各大平台都在讓 AI Agent 能夠自主執行任務、調用服務、甚至進行金融交易。

根據行業預測，到 2028 年將有超過 50% 的網際網路交易由 AI Agent 發起。

然而，當 Agent 需要在鏈上操作資產時，我們面臨一個根本性的信任問題：**如何安全地讓 AI 操作你的錢？**

#### 問題分析

AI Agent 越來越需要自主花錢——調用 API、購買雲端資源、支付服務費用、執行 DeFi 交易。但目前鏈上世界沒有一個安全的授權框架來處理這件事。

現有的做法大多是直接把私鑰交給 Agent，這等於把保險箱密碼交給一個陌生人——零權限控制、零過期機制、零事後追查。

**三個核心缺陷：**

1. **全有或全無的權限模型**：EVM 的 approve/transferFrom 模式只能設定「額度」，無法限制操作類型、頻率、對手方或有效期限。Agent 一旦被授權，就可以在額度內無限制地操作。

2. **缺乏即時撤銷機制**：當 Agent 行為異常時，用戶需要轉移所有資產才能「停損」，而不是簡單地撤銷權限。這在緊急情況下的反應時間太慢。

3. **透明度不足**：Agent 執行了哪些操作、花了多少錢、用了什麼策略，用戶往往無法在鏈上清晰追查。當 Agent 做出虧損決策時，事後甚至難以分析原因。

#### 解決方案

AgentVault 是 Sui 上第一個 policy-based AI agent wallet。核心理念很簡單：**不要把鑰匙交給 AI，而是給它一個「預算」**。

Owner 在鏈上建立一個 Vault（保險箱），存入資金並設定一套 Policy（規則），包括：
- 總預算上限
- 單筆最大金額
- 允許的操作類型（如只允許 swap）
- 最小交易間隔（cooldown）
- 授權到期時間

AI Agent 持有一個 AgentCap（權限憑證），只能在這些規則內自主交易。每一筆操作都在鏈上可驗證，Owner 隨時可以銷毀 AgentCap 來立即停止 Agent 的所有權限。

這個設計的核心思想來自傳統企業資安中的「最小權限原則」（Principle of Least Privilege）：每個代理只獲得完成任務所需的最少權限，而且權限有明確的範圍和有效期。

#### 核心流程

AgentVault 的完整運作流程分為四個階段：

1. **建立（Setup）**：Owner 透過 zkLogin（Google 帳號）登入，建立 Vault、存入資金、設定 Policy 規則，並產生一個 AgentCap 轉移給 Agent 地址。整個過程透過 Sponsored Transaction 完成，用戶不需要持有任何 SUI 付 gas。

2. **分析（Analysis）**：Agent 定期讀取 DeepBook V3 訂單簿數據（價格、深度、Spread），將市場數據傳送給 Claude API 進行分析，Claude 返回結構化的交易意圖（TradingIntent），包含操作類型、金額和推理原因。

3. **執行（Execution）**：系統先在本地預檢查 Policy（避免浪費 gas），通過後組裝一筆 Programmable Transaction Block (PTB)，在單一原子交易內完成：從 Vault 提取資金 → 在 DeepBook 執行 Swap → 將結果轉入 Owner 地址。全部透過 Sponsored TX 執行，Agent 不需持有 SUI。

4. **監控（Monitoring）**：Owner 可以在 Dashboard 即時查看 Agent 的所有活動日誌（包含每筆交易的金額、原因、結果），所有資料都可在鏈上驗證。當發現異常時，Owner 可以一鍵銷毀 AgentCap，Agent 立即失去所有操作權限，Vault 內的資金完全安全。

#### 創新點與差異化

AgentVault 的核心創新在於將 Sui 的多個獨特特性融合為一個完整的 Agent 授權方案：

- 透過 **Object Capabilities** 將 Agent 權限資產化（AgentCap 是一個可轉移、可銷毀的 Object）
- 透過 **PTB** 將「Policy 檢查 + 資金提取 + 交易執行」壓縮在單一原子交易內，消除中間狀態風險
- 透過 **Move 的線性類型系統**在編譯期保證 AgentCap 不會被複製或任意建立
- 透過 **zkLogin** 讓 Owner 用 Google 帳號即可登入，不需安裝錢包擴充
- 透過 **Sponsored TX** 讓 Agent 執行交易時不需自己持有 SUI 付 gas

這些特性的組合在其他鏈上無法原生實現。

#### 競品對比

目前市場上的 AI Agent 錢包方案主要有幾種：

- 第一類是直接將私鑰內嵌在 Agent 中（如大多數 Eliza 生態專案），這等於零權限控制
- 第二類是 EVM 上的 Session Key / ERC-7715，只能做到額度控制，無法限制操作類型和頻率
- 第三類是多重簽名方案，每筆交易都需要人工批准，失去了 Agent 自主性的意義

AgentVault 是首個在鏈上實現「多維度 Policy 控制 + 即時撤銷 + 全鏈上可驗證」的 Agent 授權方案，在安全性與自主性之間找到了最佳平衡。

### 1.3 Sui 特性使用

| Sui 特性 | 如何使用 | 為什麼其他鏈做不到 |
|----------|----------|-------------------|
| Object Capabilities | AgentCap object 代表 Agent 權限，可撤銷/轉移 | EVM 的 approve 模式無法做到細粒度控制 |
| PTB | 單筆交易內：檢查規則 + 執行交易 + 更新狀態 | EVM 需要多筆交易或複雜合約邏輯 |
| Sponsored TX | Agent 執行交易不需要自己持有 SUI 付 gas | 其他鏈的 meta-tx 更複雜 |
| zkLogin | Owner 用 Google 登入，零門檻建立錢包 | EVM 需要安裝錢包擴充 |
| Move 類型安全 | 編譯期保證 AgentCap 不會被任意複製 | Solidity 的 modifier 可被繞過 |

---

## 二、技術架構 (Technical Architecture)

### 2.1 整體架構圖

```
┌───────────────────────────────────────────────────────────┐
│ Layer 1: Frontend (Next.js 14 + React)                    │
│ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐        │
│ │ zkLogin Auth │ │ Vault Mgmt  │ │ Agent Monitor│        │
│ └──────────────┘ └─────────────┘ └──────────────┘        │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│ Layer 2: Backend (Next.js API + Agent Runtime)            │
│ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐        │
│ │ Claude API   │ │ PTB Builder │ │ Sponsor Svc  │        │
│ └──────────────┘ └─────────────┘ └──────────────┘        │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│ Layer 3: Sui Blockchain                                   │
│ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐        │
│ │ AgentVault   │ │ DeepBook V3 │ │   zkLogin    │        │
│ │   (Move)     │ │   (CLOB)    │ │    (Auth)    │        │
│ └──────────────┘ └─────────────┘ └──────────────┘        │
└───────────────────────────────────────────────────────────┘
```

### 2.2 技術栈 (Tech Stack)

| 層級 | 技術 | 版本 / 套件 |
|------|------|-------------|
| 前端 | Next.js 14 (App Router) + TypeScript + Tailwind CSS | next@14, react@18 |
| Sui SDK | @mysten/sui, @mysten/zklogin | @mysten/sui@latest |
| DeepBook | @mysten/deepbook-v3 | v0.17.0 (npm latest) |
| AI | Anthropic Claude API | claude-sonnet-4-20250514 |
| 合約 | Move 智能合約 (Sui Move) | Sui Testnet |
| 部署 | Vercel (frontend) + Railway (agent) | |

---

## 三、目錄結構 (Directory Structure)

```
agent-vault/
├── contracts/                    # Move 合約
│   ├── Move.toml
│   └── sources/
│       ├── agent_vault.move      # 核心合約：Vault + AgentCap + Policy
│       └── agent_vault_tests.move
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx
│   ├── page.tsx                  # Landing / Dashboard
│   ├── vault/
│   │   ├── create/page.tsx       # 建立 Vault + 設定 Policy
│   │   └── [id]/page.tsx         # Vault 詳情 + Agent 活動日誌
│   └── api/
│       ├── auth/                 # zkLogin OAuth callback
│       ├── agent/                # Agent 運行端點
│       └── sponsor/              # Sponsored TX 端點
├── lib/
│   ├── sui/
│   │   ├── client.ts             # SuiClient 建立
│   │   ├── zklogin.ts            # zkLogin 流程
│   │   └── deepbook.ts           # DeepBook V3 整合
│   ├── agent/
│   │   ├── runtime.ts            # Agent 運行時
│   │   ├── intent-parser.ts      # LLM Intent 解析
│   │   └── policy-checker.ts     # Policy 檢查邏輯
│   ├── vault/
│   │   ├── ptb-builder.ts        # PTB 組裝
│   │   └── types.ts              # 共用型別
│   └── constants.ts              # 合約地址、Pool ID 等
├── components/
│   ├── VaultCard.tsx
│   ├── PolicyForm.tsx
│   ├── AgentActivityLog.tsx
│   └── TradeConfirmation.tsx
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 四、Move 合約設計 (Smart Contract)

### 4.1 核心 Struct

```move
module agent_vault::agent_vault {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::clock::Clock;
    use sui::sui::SUI;

    /// 錯誤碼
    const E_BUDGET_EXCEEDED: u64 = 1;
    const E_NOT_WHITELISTED: u64 = 2;
    const E_EXPIRED: u64 = 3;
    const E_COOLDOWN: u64 = 4;

    /// Vault: 持有資金的共享 Object
    struct Vault has key {
        id: UID,
        owner: address,
        balance_sui: Balance<SUI>,
        policy: Policy,
        total_spent: u64,      // 累計花費
        last_tx_time: u64,     // 上次交易時間戳
        tx_count: u64,         // 交易次數
    }

    /// Policy: 權限規則
    struct Policy has store, drop {
        max_budget: u64,             // 最大總預算 (MIST)
        max_per_tx: u64,             // 單筆最大 (MIST)
        allowed_actions: vector<u8>, // 0=swap, 1=limit_order
        cooldown_ms: u64,            // 最小交易間隔
        expires_at: u64,             // 過期時間戳 (ms)
    }

    /// AgentCap: Agent 的權限憑證 (owned object)
    struct AgentCap has key, store {
        id: UID,
        vault_id: address,     // 對應的 Vault
    }
}
```

### 4.2 核心函數

| 函數名 | 調用者 | 功能 |
|--------|--------|------|
| create_vault | Owner | 建立 Vault + 設定 Policy + 存入初始資金 |
| create_agent_cap | Owner | 為 Agent 建立 AgentCap，轉移給 Agent 地址 |
| agent_withdraw | Agent (via AgentCap) | 從 Vault 提取資金（檢查 Policy） |
| revoke_agent | Owner | 銷毀 AgentCap，立即停止 Agent 權限 |
| update_policy | Owner | 更新 Policy 規則 |
| withdraw_all | Owner | 提取所有資金 |
| get_vault_info | Anyone | 查詢 Vault 狀態（餘額、花費、Policy） |

### 4.3 agent_withdraw 核心邏輯

這是最關鍵的函數，需要檢查所有 Policy 規則：

```move
public fun agent_withdraw(
    vault: &mut Vault,
    cap: &AgentCap,
    amount: u64,
    action_type: u8,    // 0=swap, 1=limit_order
    clock: &Clock,
    ctx: &mut TxContext,
): Coin<SUI> {
    // 1. 驗證 AgentCap 屬於此 Vault
    assert!(object::id_address(&vault.id) == cap.vault_id);

    // 2. 檢查過期
    let now = clock::timestamp_ms(clock);
    assert!(now < vault.policy.expires_at, E_EXPIRED);

    // 3. 檢查 cooldown
    assert!(now - vault.last_tx_time >= vault.policy.cooldown_ms, E_COOLDOWN);

    // 4. 檢查單筆上限
    assert!(amount <= vault.policy.max_per_tx, E_BUDGET_EXCEEDED);

    // 5. 檢查總預算
    assert!(vault.total_spent + amount <= vault.policy.max_budget, E_BUDGET_EXCEEDED);

    // 6. 檢查 action 白名單
    assert!(vector::contains(&vault.policy.allowed_actions, &action_type), E_NOT_WHITELISTED);

    // 7. 更新狀態
    vault.total_spent = vault.total_spent + amount;
    vault.last_tx_time = now;
    vault.tx_count = vault.tx_count + 1;

    // 8. 提取資金
    coin::from_balance(balance::split(&mut vault.balance_sui, amount), ctx)
}
```

---

## 五、DeepBook V3 整合 (SDK Integration)

### 重要：DeepBook V3 有兩種操作模式

1. **Swap 模式**：直接用 Coin Object 交易，不需要 BalanceManager（我們用這個）
2. **Order 模式**：需要建立 BalanceManager，適用於掛單/做市（MVP 後期再加）

### 5.1 SDK 安裝與初始化

```typescript
// 安裝
npm install @mysten/deepbook-v3 @mysten/sui

// lib/sui/deepbook.ts
import { DeepBookClient } from '@mysten/deepbook-v3';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
});

const dbClient = new DeepBookClient({
  address: agentAddress,  // Agent 的地址
  env: 'testnet',
  client: suiClient,
});
```

### 5.2 Swap 函數（核心）

DeepBook V3 提供兩個 swap 函數，可直接用 Coin Object：

| 函數 | 輸入 | 輸出 | 用途 |
|------|------|------|------|
| swapExactBaseForQuote | Base Coin (e.g. SUI) | Quote Coin (e.g. DBUSDC) | 賣出 SUI 換 USDC |
| swapExactQuoteForBase | Quote Coin (e.g. DBUSDC) | Base Coin (e.g. SUI) | 用 USDC 買入 SUI |

```typescript
// 賣出 SUI 換 USDC
const swapSuiToUsdc = (tx: Transaction) => {
  const [baseOut, quoteOut, deepOut] = dbClient.swapExactBaseForQuote({
    poolKey: 'SUI_DBUSDC',
    amount: 1,           // 賣出 1 SUI
    deepAmount: 1,       // DEEP token 付費用（多餘退回）
    minOut: 0.1,         // 最少收到 0.1 DBUSDC，否則交易失敗
  })(tx);

  // 轉移結果給 Agent 地址
  tx.transferObjects([baseOut, quoteOut, deepOut], agentAddress);
};

// 用 USDC 買入 SUI
const swapUsdcToSui = (tx: Transaction) => {
  const [baseOut, quoteOut, deepOut] = dbClient.swapExactQuoteForBase({
    poolKey: 'SUI_DBUSDC',
    amount: 1,           // 用 1 DBUSDC
    deepAmount: 1,       // DEEP fee
    minOut: 0.1,         // 最少收到 0.1 SUI
  })(tx);

  tx.transferObjects([baseOut, quoteOut, deepOut], agentAddress);
};
```

### 5.3 Pool Keys 與幣種

DeepBook V3 SDK 內建常用 pool keys（在 /utils/constants.ts）：

| Pool Key | Base | Quote | 說明 |
|----------|------|-------|------|
| SUI_DBUSDC | SUI | DBUSDC | 主要交易對，MVP 先用這個 |
| DEEP_SUI | DEEP | SUI | DEEP/SUI 池（白名單，0% 費用） |
| DEEP_DBUSDC | DEEP | DBUSDC | DEEP/USDC 池（白名單，0% 費用） |

**DEEP Token 費用注意事項：**
- 所有 swap 都需要支付 DEEP token 作為手續費
- Testnet 上 DEEP/SUI 和 DEEP/USDC 池是白名單，0% 手續費
- Agent 需要持有少量 DEEP token，多餘的會自動退回

### 5.4 查詢訂單簿深度 (Read-Only)

```typescript
// 查詢 SUI/USDC 訂單簿
const orderbook = await dbClient.getLevel2Range(
  'SUI_DBUSDC',  // poolKey
  0.1,           // lowerPrice
  100,           // higherPrice
  true           // is_bid side
);
console.log(orderbook);
```

---

## 六、Agent Runtime 設計

### 6.1 Agent 運行流程

Agent 是一個 Node.js 長駐服務，循環執行以下流程：

1. 等待觸發（定時 / 事件駅動）
2. 讀取市場數據（DeepBook orderbook）
3. 傳送市場數據給 Claude API 分析
4. Claude 返回結構化 TradingIntent
5. Policy Checker 檢查是否符合規則
6. 組裝 PTB：agent_withdraw + DeepBook swap
7. Sponsored TX 簽名並執行
8. 記錄日誌，通知前端

### 6.2 LLM Intent Parser

```typescript
// lib/agent/intent-parser.ts
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a DeFi trading agent on Sui blockchain via DeepBook.
Analyze market data and decide on trading actions.

Available actions:
- swap_sui_to_usdc: Sell SUI for USDC
- swap_usdc_to_sui: Buy SUI with USDC
- hold: Do nothing this round

Response format (JSON only):
{
  "action": "swap_sui_to_usdc",
  "amount": 0.5,
  "reason": "Price is above 24h average, taking profit"
}`;

interface TradingIntent {
  action: 'swap_sui_to_usdc' | 'swap_usdc_to_sui' | 'hold';
  amount: number;
  reason: string;
}

export async function parseMarketData(marketData: any): Promise<TradingIntent> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(marketData) }],
  });

  return JSON.parse(response.content[0].text);
}
```

### 6.3 PTB 組裝（關鍵流程）

單筆 PTB 內完成：Vault 提取 → DeepBook Swap → 結果回到 Vault

```typescript
// lib/vault/ptb-builder.ts
import { Transaction } from '@mysten/sui/transactions';

export function buildAgentSwapPTB(
  vaultId: string,
  agentCapId: string,
  amount: number,
  direction: 'sui_to_usdc' | 'usdc_to_sui',
  minOut: number,
) {
  const tx = new Transaction();

  // Step 1: Agent 從 Vault 提取資金
  const coin = tx.moveCall({
    target: `${PACKAGE_ID}::agent_vault::agent_withdraw`,
    arguments: [
      tx.object(vaultId),
      tx.object(agentCapId),
      tx.pure.u64(amount * 1e9),  // MIST
      tx.pure.u8(0),              // action_type: swap
      tx.object('0x6'),           // Clock
    ],
  });

  // Step 2: DeepBook Swap
  if (direction === 'sui_to_usdc') {
    const [baseOut, quoteOut, deepOut] = dbClient.swapExactBaseForQuote({
      poolKey: 'SUI_DBUSDC',
      amount: amount,
      deepAmount: 0.1,
      minOut: minOut,
      baseCoin: coin,  // 從 Vault 提取的 Coin
    })(tx);

    // Step 3: 結果轉給 Vault owner
    tx.transferObjects([baseOut, quoteOut, deepOut], vaultOwnerAddress);
  }

  return tx;
}
```

---

## 七、zkLogin 整合

### 7.1 流程總覽

zkLogin 讓 Owner 用 Google 帳號登入，無需安裝錢包：

1. Owner 點擊 "Sign in with Google"
2. Google OAuth 返回 JWT token
3. 後端用 JWT + ephemeral key + salt 生成 ZK 證明
4. 得到一個 Sui 地址，可以簽名交易

### 7.2 實作重點

請參考 Sui 官方文檔 docs.sui.io/guides/developer/cryptography/zklogin。

以下是關鍵要點：
- **Ephemeral KeyPair**：每次登入生成，存在 sessionStorage
- **Salt**：用 sub (Google user ID) 的 hash 生成，確保每次登入地址一致
- **Prover**：用 Mysten Labs 的 ZK prover service（testnet 免費）
- **maxEpoch**：設為當前 epoch + 2，約 48 小時有效

---

## 八、Sponsored Transaction

讓用戶和 Agent 都不需要自己持有 SUI 付 gas：

```typescript
// api/sponsor/route.ts
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const sponsorKeypair = Ed25519Keypair.fromSecretKey(
  process.env.SPONSOR_PRIVATE_KEY!
);

export async function sponsorTransaction(txBytes: Uint8Array) {
  const tx = Transaction.from(txBytes);

  tx.setSender(userAddress);
  tx.setGasOwner(sponsorKeypair.getPublicKey().toSuiAddress());

  // Sponsor 簽名 gas
  const sponsorSig = await sponsorKeypair.signTransaction(
    await tx.build({ client: suiClient })
  );

  return { txBytes: tx.build(), sponsorSig };
}
```

---

## 九、開發排程 (5 Day Plan)

| 天數 | 任務 | 產出 | 優先級 |
|------|------|------|--------|
| Day 1 | Move 合約 + 部署到 Testnet | agent_vault.move 部署完成，Package ID 取得 | P0 |
| Day 2 | DeepBook SDK 整合 + PTB Builder | swap 功能可在本地測試 | P0 |
| Day 3 | Agent Runtime + Claude API | Agent 可自動分析並執行交易 | P0 |
| Day 4 | zkLogin + Sponsored TX + 前端 UI | 完整 Demo 流程可運行 | P0 |
| Day 5 | Demo 影片 + 文檔 + 提交 | 提交所有材料 | P0 |

### 9.1 Day 1 詳細 Checklist

- [ ] 初始化 Next.js 14 專案: `npx create-next-app@latest agent-vault --typescript --tailwind --app`
- [ ] 安裝依賴: `npm install @mysten/sui @mysten/zklogin @mysten/deepbook-v3 @anthropic-ai/sdk`
- [ ] 建立 Move 合約目錄結構
- [ ] 寫 agent_vault.move（Vault + AgentCap + Policy + 核心函數）
- [ ] 寫測試: agent_vault_tests.move
- [ ] 部署到 Sui Testnet: `sui client publish --gas-budget 100000000`
- [ ] 記錄 Package ID 到 .env

### 9.2 Day 2 詳細 Checklist

- [ ] 建立 lib/sui/deepbook.ts: DeepBookClient 初始化
- [ ] 實作 swapExactBaseForQuote 和 swapExactQuoteForBase wrapper
- [ ] 建立 lib/vault/ptb-builder.ts: 組裝 agent_withdraw + swap PTB
- [ ] 本地測試: 手動執行完整 withdraw + swap 流程
- [ ] 確認 DEEP token 費用機制正常運作

### 9.3 Day 3 詳細 Checklist

- [ ] 建立 lib/agent/runtime.ts: Agent 主迴圈
- [ ] 建立 lib/agent/intent-parser.ts: Claude API 分析市場數據
- [ ] 建立 lib/agent/policy-checker.ts: 本地 Policy 預檢查
- [ ] 建立 api/agent/route.ts: Agent 運行端點
- [ ] 測試 Agent 自動執行完整流程

### 9.4 Day 4 詳細 Checklist

- [ ] zkLogin 整合: Google OAuth + ZK Prover + ephemeral key
- [ ] Sponsored TX 整合: gas sponsor 端點
- [ ] 前端 UI: Dashboard + Vault 建立 + Agent 活動日誌 + 一鍵撤銷
- [ ] 端到端測試: Google 登入 → 建立 Vault → Agent 自動交易

### 9.5 Day 5 詳細 Checklist

- [ ] 錄製 Demo 影片（3 分鐘以內）
- [ ] 寫 README.md（安裝說明 + 架構圖 + 截圖）
- [ ] 建立 .env.example
- [ ] 部署到 Vercel（前端）+ Railway（agent）
- [ ] 填寫 HackMoney 提交表單

---

## 十、環境變數 (.env.example)

```bash
# Sui Network
NEXT_PUBLIC_SUI_NETWORK=testnet

# Move Contract
NEXT_PUBLIC_PACKAGE_ID=0x...  # 部署後填入

# zkLogin (Google OAuth)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Claude API
ANTHROPIC_API_KEY=sk-ant-xxx

# Sponsor Wallet (用於代付 gas)
SPONSOR_PRIVATE_KEY=suiprivkey1...

# Agent Wallet
AGENT_PRIVATE_KEY=suiprivkey1...
```

---

## 十一、Demo 腳本 (3 分鐘)

| 時間 | 畫面 | 旁白 |
|------|------|------|
| 0:00-0:20 | 問題陳述 | AI Agent 需要花錢，但現有方案都是把私鑰直接給 Agent |
| 0:20-0:40 | 解決方案 | AgentVault: Don't give keys, give a budget |
| 0:40-1:10 | Demo: Google 登入 | zkLogin 3秒建立錢包，不需安裝任何擴充 |
| 1:10-1:50 | Demo: 建立 Vault | 設定預算 10 SUI、單筆上限 1 SUI、只允許 swap、24小時到期 |
| 1:50-2:30 | Demo: Agent 自動交易 | Agent 分析市場 → 決定賣出 0.5 SUI → 檢查 Policy → 執行 Swap → 成功 |
| 2:30-2:45 | Demo: 過限與撤銷 | Agent 嘗試超過預算 → 被擋回。Owner 一鍵撤銷 AgentCap |
| 2:45-3:00 | 總結 | AgentVault: Policy-based AI agent wallet on Sui |

---

## 十二、注意事項與潛在風險

| 風險 | 影響 | 緩解方案 |
|------|------|----------|
| DeepBook testnet 流動性不足 | 高 | 準備自己在對手端掛單，確保 Demo 有流動性 |
| DEEP token 在 testnet 取得困難 | 中 | 用 DEEP/SUI 白名單池免費換取 |
| zkLogin ZK prover 慢 | 中 | Demo 時預先登入，避免現場等待 |
| Move 合約 bug | 高 | Day 1 先寫測試，確保合約正確 |
| Agent 做出虧的交易決策 | 低 | Demo 用硬編碼市場數據確保穩定 |

---

**AgentVault**
*"Don't give your AI agent the keys. Give it a budget."*
