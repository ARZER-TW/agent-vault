/**
 * Agent PTB builders that require server-only SDKs (Cetus, Stablelayer).
 * These must NOT be imported from client-side components ("use client").
 * For browser-safe PTB builders, use ptb-builder.ts instead.
 */
import { Transaction } from "@mysten/sui/transactions";
import BN from "bn.js";
import { getCetusClient, getTokenTypes } from "@/lib/sui/cetus";
import { getStableLayerClient } from "@/lib/sui/stablelayer";
import {
  PACKAGE_ID,
  MODULE_NAME,
  CLOCK_OBJECT_ID,
  ACTION_SWAP,
  ACTION_STABLE_MINT,
  CETUS_DEFAULT_SLIPPAGE,
} from "@/lib/constants";

/** LakeUSDC type for Stablelayer mint/burn/claim operations */
const STABLE_COIN_TYPE =
  "0xb75744fadcbfc174627567ca29645d0af8f6e6fd01b6f57c75a08cd3fb97c567::lake_usdc::LakeUSDC";

/**
 * Build PTB for agent swap via Cetus Aggregator: agent_withdraw -> Cetus router swap.
 *
 * Flow in a single PTB:
 * 1. agent_withdraw from Vault -> get Coin<SUI>
 * 2. Find best route via Cetus Aggregator
 * 3. Execute router swap with the withdrawn coin
 * 4. Transfer swap output to vault owner
 */
export async function buildAgentCetusSwap(params: {
  vaultId: string;
  agentCapId: string;
  ownerAddress: string;
  amountMist: bigint;
  targetCoinType?: string;
  slippage?: number;
}): Promise<Transaction> {
  const {
    vaultId,
    agentCapId,
    ownerAddress,
    amountMist,
    slippage = CETUS_DEFAULT_SLIPPAGE,
  } = params;

  // Validate slippage bounds (0-5%)
  if (slippage < 0 || slippage > 0.05) {
    throw new Error(`Slippage out of safe range: ${slippage}. Must be 0-5%.`);
  }

  const tokens = getTokenTypes();
  const targetCoinType = params.targetCoinType ?? tokens.USDC;

  const tx = new Transaction();

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

  // Step 2: Find best swap route via Cetus Aggregator
  const cetusClient = getCetusClient();
  const routerData = await cetusClient.findRouters({
    from: tokens.SUI,
    target: targetCoinType,
    amount: new BN(amountMist.toString()),
    byAmountIn: true,
  });

  if (!routerData || routerData.paths.length === 0) {
    throw new Error(
      `Cetus: no swap route found from SUI to ${targetCoinType} for amount ${amountMist.toString()} MIST`,
    );
  }

  // Step 3: Execute router swap (pass our withdrawn coin as inputCoin)
  const outputCoin = await cetusClient.routerSwap({
    router: routerData,
    inputCoin: withdrawnCoin,
    slippage,
    txb: tx,
  });

  // Step 4: Transfer swap output to vault owner
  tx.transferObjects([outputCoin], ownerAddress);

  return tx;
}

/**
 * Build PTB for agent stable mint: agent_withdraw -> Cetus swap SUI->USDC -> Stablelayer mint.
 *
 * Flow in a single PTB:
 * 1. agent_withdraw from Vault -> get Coin<SUI>
 * 2. Swap SUI -> USDC via Cetus Aggregator
 * 3. Mint stablecoin (LakeUSDC) via Stablelayer using the USDC
 */
export async function buildAgentStableMint(params: {
  vaultId: string;
  agentCapId: string;
  agentAddress: string;
  ownerAddress: string;
  amountMist: bigint;
  stableCoinType?: string;
}): Promise<Transaction> {
  const {
    vaultId,
    agentCapId,
    agentAddress,
    ownerAddress,
    amountMist,
    stableCoinType = STABLE_COIN_TYPE,
  } = params;

  const tokens = getTokenTypes();
  const tx = new Transaction();

  // Step 1: agent_withdraw from Vault
  const withdrawnCoin = tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::agent_withdraw`,
    arguments: [
      tx.object(vaultId),
      tx.object(agentCapId),
      tx.pure.u64(amountMist),
      tx.pure.u8(ACTION_STABLE_MINT),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  // Step 2: Swap SUI -> USDC via Cetus
  const cetusClient = getCetusClient();
  const routerData = await cetusClient.findRouters({
    from: tokens.SUI,
    target: tokens.USDC,
    amount: new BN(amountMist.toString()),
    byAmountIn: true,
  });

  if (!routerData || routerData.paths.length === 0) {
    throw new Error(
      `Cetus: no swap route found from SUI to USDC for amount ${amountMist.toString()} MIST`,
    );
  }

  const usdcCoin = await cetusClient.routerSwap({
    router: routerData,
    inputCoin: withdrawnCoin,
    slippage: CETUS_DEFAULT_SLIPPAGE,
    txb: tx,
  });

  // Expected USDC output from Cetus route (used as mint amount hint)
  const expectedUsdcOut = BigInt(routerData.amountOut.toString());

  // Step 3: Mint stablecoin via Stablelayer
  const slClient = getStableLayerClient(agentAddress);
  await slClient.buildMintTx({
    tx,
    stableCoinType,
    usdcCoin,
    amount: expectedUsdcOut,
    sender: ownerAddress,
    autoTransfer: true,
  });

  return tx;
}

/**
 * Build PTB for agent stable burn: burn stablecoin (LakeUSDC) back to USDC.
 *
 * Uses Stablelayer buildBurnTx with autoTransfer to send result to owner.
 */
export async function buildAgentStableBurn(params: {
  agentAddress: string;
  ownerAddress: string;
  amount?: bigint;
  burnAll?: boolean;
  stableCoinType?: string;
}): Promise<Transaction> {
  const {
    agentAddress,
    ownerAddress,
    amount,
    burnAll = false,
    stableCoinType = STABLE_COIN_TYPE,
  } = params;

  const tx = new Transaction();

  const slClient = getStableLayerClient(agentAddress);
  await slClient.buildBurnTx({
    tx,
    stableCoinType,
    amount,
    all: burnAll,
    sender: ownerAddress,
    autoTransfer: true,
  });

  return tx;
}

/**
 * Build PTB for agent stable claim: claim accrued yield from Stablelayer.
 *
 * Uses Stablelayer buildClaimTx with autoTransfer to send result to owner.
 */
export async function buildAgentStableClaim(params: {
  agentAddress: string;
  ownerAddress: string;
  stableCoinType?: string;
}): Promise<Transaction> {
  const {
    agentAddress,
    ownerAddress,
    stableCoinType = STABLE_COIN_TYPE,
  } = params;

  const tx = new Transaction();

  const slClient = getStableLayerClient(agentAddress);
  await slClient.buildClaimTx({
    tx,
    stableCoinType,
    sender: ownerAddress,
    autoTransfer: true,
  });

  return tx;
}
