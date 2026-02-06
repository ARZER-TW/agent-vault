import type { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getSuiClient } from "@/lib/sui/client";
import { buildZkLoginSignature } from "./zklogin";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";

/**
 * Execute a sponsored transaction where the sponsor pays gas.
 *
 * Flow:
 * 1. Set sponsor as gas owner on the transaction
 * 2. Serialize the transaction bytes
 * 3. Sponsor signs the gas portion (with sponsor keypair)
 * 4. User signs the action portion (with ephemeral keypair + zkLogin)
 * 5. Execute with both signatures
 */
export async function executeSponsoredTransaction(params: {
  transaction: Transaction;
  senderAddress: string;
  ephemeralKeypair: Ed25519Keypair;
  zkProof: ZkLoginSignatureInputs;
  maxEpoch: number;
}): Promise<string> {
  const { transaction, senderAddress, ephemeralKeypair, zkProof, maxEpoch } =
    params;

  const sponsorKeyStr = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorKeyStr) {
    throw new Error("SPONSOR_PRIVATE_KEY is not set");
  }

  const sponsorKeypair = Ed25519Keypair.fromSecretKey(sponsorKeyStr);
  const client = getSuiClient();

  // Set sender and gas owner
  transaction.setSender(senderAddress);
  transaction.setGasOwner(sponsorKeypair.getPublicKey().toSuiAddress());

  // Build the transaction bytes
  const txBytes = await transaction.build({ client });

  // Sponsor signs gas portion
  const sponsorSignature = await sponsorKeypair.sign(txBytes);
  const sponsorSigBase64 = btoa(
    String.fromCharCode(...sponsorSignature),
  );

  // User (ephemeral key) signs action portion
  const userSignature = await ephemeralKeypair.sign(txBytes);
  const userSigBase64 = btoa(
    String.fromCharCode(...userSignature),
  );

  // Build zkLogin signature wrapping the ephemeral signature
  const zkLoginSig = buildZkLoginSignature({
    userSignature: userSigBase64,
    zkProof,
    maxEpoch,
  });

  // Execute with both signatures
  const result = await client.executeTransactionBlock({
    transactionBlock: txBytes,
    signature: [zkLoginSig, sponsorSigBase64],
  });

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
  });

  return result.digest;
}

/**
 * Execute a transaction where the agent signs the action
 * and the sponsor pays for gas. No zkLogin involved.
 *
 * Flow:
 * 1. Agent is the sender (owns AgentCap)
 * 2. Sponsor is the gas owner (pays gas)
 * 3. Both sign with Ed25519 keypairs
 * 4. Execute with both signatures (sender first)
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

  // Agent is the sender, sponsor pays gas
  transaction.setSender(agentAddress);
  transaction.setGasOwner(sponsorAddress);

  const txBytes = await transaction.build({ client });

  // Both sign using signTransaction (returns { signature: string })
  const agentSig = await agentKeypair.signTransaction(txBytes);
  const sponsorSig = await sponsorKeypair.signTransaction(txBytes);

  // Execute with both signatures -- sender (agent) first
  const result = await client.executeTransactionBlock({
    transactionBlock: txBytes,
    signature: [agentSig.signature, sponsorSig.signature],
  });

  return result.digest;
}
