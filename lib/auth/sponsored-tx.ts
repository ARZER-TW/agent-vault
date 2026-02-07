import type { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";
import { getSuiClient } from "@/lib/sui/client";
import { buildZkLoginSignature } from "./zklogin";

/**
 * Execute a NON-sponsored transaction where the user pays their own gas.
 * Used for debugging to isolate zkLogin signature issues from sponsor issues.
 */
export async function executeDirectZkLoginTransaction(params: {
  transaction: Transaction;
  senderAddress: string;
  ephemeralKeypair: Ed25519Keypair;
  zkProof: ZkLoginSignatureInputs;
  maxEpoch: number;
}): Promise<string> {
  const { transaction, senderAddress, ephemeralKeypair, zkProof, maxEpoch } =
    params;

  const client = getSuiClient();

  // User pays own gas - no sponsor
  transaction.setSender(senderAddress);

  // Sign with ephemeral key
  const { bytes: txBytesBase64, signature: ephemeralSignature } =
    await transaction.sign({ client, signer: ephemeralKeypair });

  // Wrap in zkLogin
  const zkLoginSig = buildZkLoginSignature({
    userSignature: ephemeralSignature,
    zkProof,
    maxEpoch,
  });

  // Execute directly with single zkLogin signature
  const result = await client.executeTransactionBlock({
    transactionBlock: txBytesBase64,
    signature: zkLoginSig,
    options: { showEffects: true },
  });

  const status = result.effects?.status?.status;
  if (status !== "success") {
    const errorMsg = result.effects?.status?.error ?? "Transaction failed on-chain";
    throw new Error(`zkLogin TX failed: ${errorMsg}`);
  }

  return result.digest;
}

/**
 * Execute a transaction with a standard keypair (no zkLogin, no sponsor).
 * Used for agent-side execution where the agent has its own keypair.
 */
export async function executeAgentTransaction(params: {
  transaction: Transaction;
  agentKeypair: Ed25519Keypair;
}): Promise<string> {
  const { transaction, agentKeypair } = params;
  const client = getSuiClient();

  const result = await client.signAndExecuteTransaction({
    transaction,
    signer: agentKeypair,
    options: { showEffects: true },
  });

  const status = result.effects?.status?.status;
  if (status !== "success") {
    const errorMsg = result.effects?.status?.error ?? "Transaction failed on-chain";
    throw new Error(`Agent TX failed: ${errorMsg}`);
  }

  return result.digest;
}

/**
 * Execute a transaction where the agent signs the action
 * and the sponsor pays for gas. No zkLogin involved.
 * Server-side only (used in API routes).
 */
export async function executeSponsoredAgentTransaction(params: {
  transaction: Transaction;
  agentKeypair: Ed25519Keypair;
}): Promise<string> {
  const { transaction, agentKeypair } = params;

  const sponsorKeyStr = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorKeyStr) {
    throw new Error("SPONSOR_PRIVATE_KEY is not set");
  }

  const sponsorKeypair = Ed25519Keypair.fromSecretKey(sponsorKeyStr);
  const client = getSuiClient();

  const agentAddress = agentKeypair.getPublicKey().toSuiAddress();
  const sponsorAddress = sponsorKeypair.getPublicKey().toSuiAddress();

  transaction.setSender(agentAddress);
  transaction.setGasOwner(sponsorAddress);

  const txBytes = await transaction.build({ client });

  const agentSig = await agentKeypair.signTransaction(txBytes);
  const sponsorSig = await sponsorKeypair.signTransaction(txBytes);

  const result = await client.executeTransactionBlock({
    transactionBlock: txBytes,
    signature: [agentSig.signature, sponsorSig.signature],
    options: { showEffects: true },
  });

  const status = result.effects?.status?.status;
  if (status !== "success") {
    const errorMsg = result.effects?.status?.error ?? "Transaction failed on-chain";
    throw new Error(`Sponsored agent TX failed: ${errorMsg}`);
  }

  return result.digest;
}
