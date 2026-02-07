import { Transaction } from "@mysten/sui/transactions";
import { getDeepBookClient } from "@/lib/sui/deepbook";
import {
  PACKAGE_ID,
  MODULE_NAME,
  CLOCK_OBJECT_ID,
  ACTION_SWAP,
} from "@/lib/constants";

// ============================================================
// Owner Operations
// ============================================================

/**
 * Build PTB to create a new Vault with initial deposit and policy.
 */
export function buildCreateVault(params: {
  coinObjectId?: string;
  depositAmount: bigint;
  maxBudget: bigint;
  maxPerTx: bigint;
  allowedActions: number[];
  cooldownMs: bigint;
  expiresAt: bigint;
  useGasCoin?: boolean;
}): Transaction {
  const tx = new Transaction();

  // Split the exact deposit amount
  // useGasCoin: split from gas coin (non-sponsored, avoids coin conflict)
  // otherwise: split from specific coin object (sponsored mode)
  const source = params.useGasCoin ? tx.gas : tx.object(params.coinObjectId!);
  const [depositCoin] = tx.splitCoins(source, [
    tx.pure.u64(params.depositAmount),
  ]);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_vault`,
    arguments: [
      depositCoin,
      tx.pure.u64(params.maxBudget),
      tx.pure.u64(params.maxPerTx),
      tx.pure.vector("u8", params.allowedActions),
      tx.pure.u64(params.cooldownMs),
      tx.pure.u64(params.expiresAt),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

/**
 * Build PTB to deposit SUI into a Vault.
 */
export function buildDeposit(params: {
  vaultId: string;
  ownerCapId: string;
  coinObjectId: string;
}): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::deposit`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.ownerCapId),
      tx.object(params.coinObjectId),
    ],
  });

  return tx;
}

/**
 * Build PTB to deposit SUI from gas coin into a Vault.
 * Splits exact amount from gas coin to avoid coin selection.
 */
export function buildDepositFromGas(params: {
  vaultId: string;
  ownerCapId: string;
  amount: bigint;
}): Transaction {
  const tx = new Transaction();

  const [depositCoin] = tx.splitCoins(tx.gas, [
    tx.pure.u64(params.amount),
  ]);

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::deposit`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.ownerCapId),
      depositCoin,
    ],
  });

  return tx;
}

/**
 * Build PTB for owner to withdraw all funds.
 */
export function buildWithdrawAll(params: {
  vaultId: string;
  ownerCapId: string;
  recipientAddress: string;
}): Transaction {
  const tx = new Transaction();

  const coin = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::withdraw_all`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.ownerCapId),
    ],
  });

  tx.transferObjects([coin], params.recipientAddress);

  return tx;
}

/**
 * Build PTB to update vault policy.
 */
export function buildUpdatePolicy(params: {
  vaultId: string;
  ownerCapId: string;
  maxBudget: bigint;
  maxPerTx: bigint;
  allowedActions: number[];
  cooldownMs: bigint;
  expiresAt: bigint;
}): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::update_policy`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.ownerCapId),
      tx.pure.u64(params.maxBudget),
      tx.pure.u64(params.maxPerTx),
      tx.pure.vector("u8", params.allowedActions),
      tx.pure.u64(params.cooldownMs),
      tx.pure.u64(params.expiresAt),
    ],
  });

  return tx;
}

/**
 * Build PTB to create an AgentCap for an agent address.
 */
export function buildCreateAgentCap(params: {
  vaultId: string;
  ownerCapId: string;
  agentAddress: string;
}): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_agent_cap`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.ownerCapId),
      tx.pure.address(params.agentAddress),
    ],
  });

  return tx;
}

/**
 * Build PTB to revoke an AgentCap.
 */
export function buildRevokeAgentCap(params: {
  vaultId: string;
  ownerCapId: string;
  capId: string;
}): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::revoke_agent_cap`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.ownerCapId),
      tx.pure.id(params.capId),
    ],
  });

  return tx;
}

// ============================================================
// Agent Operations
// ============================================================

/**
 * Build PTB for agent to withdraw funds (simple transfer, no swap).
 */
export function buildAgentWithdraw(params: {
  vaultId: string;
  agentCapId: string;
  amount: bigint;
  actionType: number;
  recipientAddress: string;
}): Transaction {
  const tx = new Transaction();

  const coin = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::agent_withdraw`,
    arguments: [
      tx.object(params.vaultId),
      tx.object(params.agentCapId),
      tx.pure.u64(params.amount),
      tx.pure.u8(params.actionType),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  tx.transferObjects([coin], params.recipientAddress);

  return tx;
}

/**
 * Build PTB for agent swap: agent_withdraw -> DeepBook swap.
 * This is the core atomic operation for the AI agent.
 *
 * Flow in a single PTB:
 * 1. agent_withdraw from Vault -> get Coin<SUI>
 * 2. Pass Coin<SUI> as baseCoin to DeepBook swapExactBaseForQuote
 * 3. Transfer swap results to the vault owner
 */
export function buildAgentSwap(params: {
  vaultId: string;
  agentCapId: string;
  agentAddress: string;
  ownerAddress: string;
  amountMist: bigint;
  minOut: number;
  deepAmount: number;
  poolKey?: string;
}): Transaction {
  const {
    vaultId,
    agentCapId,
    agentAddress,
    ownerAddress,
    amountMist,
    minOut,
    deepAmount,
    poolKey = "SUI_DBUSDC",
  } = params;

  const tx = new Transaction();
  const dbClient = getDeepBookClient(agentAddress);

  // Step 1: agent_withdraw from Vault
  const withdrawnCoin = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::agent_withdraw`,
    arguments: [
      tx.object(vaultId),
      tx.object(agentCapId),
      tx.pure.u64(amountMist),
      tx.pure.u8(ACTION_SWAP),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  // Step 2: DeepBook swap (passing withdrawn coin as baseCoin)
  // amount is ignored when baseCoin is provided; SDK uses the coin directly
  const [baseCoinResult, quoteCoinResult, deepCoinResult] =
    dbClient.deepBook.swapExactBaseForQuote({
      poolKey,
      amount: 0, // ignored when baseCoin is provided
      deepAmount,
      minOut,
      baseCoin: withdrawnCoin,
    })(tx);

  // Step 3: Transfer results to vault owner
  tx.transferObjects(
    [baseCoinResult, quoteCoinResult, deepCoinResult],
    ownerAddress,
  );

  return tx;
}
