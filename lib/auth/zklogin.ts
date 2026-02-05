import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  genAddressSeed,
  getZkLoginSignature,
} from "@mysten/sui/zklogin";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";
import { getSuiClient } from "@/lib/sui/client";
import { SUI_NETWORK } from "@/lib/constants";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000/auth/callback";
const PROVER_URL =
  SUI_NETWORK === "mainnet"
    ? "https://prover.mystenlabs.com/v1"
    : "https://prover-dev.mystenlabs.com/v1";

// -- Session storage keys --
const EPHEMERAL_KEY_PAIR_KEY = "zklogin_ephemeral_keypair";
const RANDOMNESS_KEY = "zklogin_randomness";
const MAX_EPOCH_KEY = "zklogin_max_epoch";
const USER_SALT_KEY = "zklogin_user_salt";

export interface ZkLoginSession {
  address: string;
  ephemeralKeypair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  jwt: string;
  userSalt: string;
  zkProof: ZkLoginSignatureInputs;
}

/**
 * Step 1: Generate ephemeral keypair and OAuth URL.
 * Returns the Google OAuth redirect URL.
 */
export async function beginZkLogin(): Promise<string> {
  const client = getSuiClient();
  const { epoch } = await client.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 2;

  const ephemeralKeypair = Ed25519Keypair.generate();
  const randomness = generateRandomness();
  const nonce = generateNonce(
    ephemeralKeypair.getPublicKey(),
    maxEpoch,
    randomness,
  );

  // Persist to session storage (client-side only)
  if (typeof window !== "undefined") {
    sessionStorage.setItem(
      EPHEMERAL_KEY_PAIR_KEY,
      ephemeralKeypair.getSecretKey(),
    );
    sessionStorage.setItem(RANDOMNESS_KEY, randomness);
    sessionStorage.setItem(MAX_EPOCH_KEY, String(maxEpoch));
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "id_token",
    scope: "openid",
    nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Step 2: Complete login after OAuth callback.
 * Takes the JWT from the URL hash, fetches ZK proof, derives address.
 */
export async function completeZkLogin(params: {
  jwt: string;
  userSalt: string;
}): Promise<ZkLoginSession> {
  const { jwt, userSalt } = params;

  // Restore ephemeral keypair from session
  const secretKeyStr = sessionStorage.getItem(EPHEMERAL_KEY_PAIR_KEY);
  const randomness = sessionStorage.getItem(RANDOMNESS_KEY);
  const maxEpochStr = sessionStorage.getItem(MAX_EPOCH_KEY);

  if (!secretKeyStr || !randomness || !maxEpochStr) {
    throw new Error("Missing zkLogin session data. Please start login again.");
  }

  const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeyStr);
  const maxEpoch = Number(maxEpochStr);

  // Derive Sui address
  const address = jwtToAddress(jwt, userSalt);

  // Get extended ephemeral public key for prover
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralKeypair.getPublicKey(),
  );

  // Fetch ZK proof from Mysten prover
  const proofResponse = await fetch(PROVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey,
      maxEpoch,
      jwtRandomness: randomness,
      salt: userSalt,
      keyClaimName: "sub",
    }),
  });

  if (!proofResponse.ok) {
    const errorText = await proofResponse.text();
    throw new Error(`ZK prover error: ${errorText}`);
  }

  const zkProof = (await proofResponse.json()) as ZkLoginSignatureInputs;

  // Store salt for future sessions
  if (typeof window !== "undefined") {
    sessionStorage.setItem(USER_SALT_KEY, userSalt);
  }

  return {
    address,
    ephemeralKeypair,
    maxEpoch,
    randomness,
    jwt,
    userSalt,
    zkProof,
  };
}

/**
 * Build a complete zkLogin signature for a transaction.
 */
export function buildZkLoginSignature(params: {
  userSignature: string;
  zkProof: ZkLoginSignatureInputs;
  maxEpoch: number;
}): string {
  return getZkLoginSignature({
    inputs: params.zkProof,
    maxEpoch: params.maxEpoch,
    userSignature: params.userSignature,
  });
}

/**
 * Derive a deterministic user salt from the JWT sub claim.
 * In production, this should be stored server-side per user.
 */
export function deriveUserSalt(jwtSub: string): string {
  // Simple deterministic salt for hackathon demo
  // Production should use a secure server-side salt storage
  const encoder = new TextEncoder();
  const data = encoder.encode(`agent-vault-salt-${jwtSub}`);
  let hash = 0n;
  for (const byte of data) {
    hash = (hash * 31n + BigInt(byte)) % (2n ** 128n);
  }
  return hash.toString();
}
