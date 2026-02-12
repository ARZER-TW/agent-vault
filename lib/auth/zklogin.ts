import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  decodeJwt,
  computeZkLoginAddressFromSeed,
  genAddressSeed,
} from "@mysten/sui/zklogin";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";
import { getSuiClient } from "@/lib/sui/client";
import { SUI_NETWORK } from "@/lib/constants";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000/auth/callback";

// Mysten Labs public ZK prover (free, no API key required)
const PROVER_URL =
  SUI_NETWORK === "mainnet"
    ? "https://prover.mystenlabs.com/v1"
    : "https://prover-dev.mystenlabs.com/v1";

// -- Session storage keys --
const EPHEMERAL_KEY_PAIR_KEY = "zklogin_ephemeral_keypair";
const RANDOMNESS_KEY = "zklogin_randomness";
const MAX_EPOCH_KEY = "zklogin_max_epoch";
const AUTH_SESSION_KEY = "zklogin_auth_session";

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
 * Derive a deterministic salt from the user's `sub` claim.
 * The salt ensures the same Google account always maps to the same zkLogin address.
 */
function deriveSalt(sub: string): string {
  let hash = BigInt(0);
  for (let i = 0; i < sub.length; i++) {
    hash = hash * BigInt(31) + BigInt(sub.charCodeAt(i));
  }
  const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
  return (hash & mask).toString();
}

/**
 * Fetch ZK proof via Mysten Labs public prover.
 */
async function fetchZkProof(params: {
  jwt: string;
  ephemeralPublicKey: string;
  maxEpoch: number;
  randomness: string;
  salt: string;
}): Promise<Omit<ZkLoginSignatureInputs, "addressSeed">> {
  const response = await fetch(PROVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt: params.jwt,
      extendedEphemeralPublicKey: params.ephemeralPublicKey,
      maxEpoch: String(params.maxEpoch),
      jwtRandomness: params.randomness,
      salt: params.salt,
      keyClaimName: "sub",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ZK prover error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Step 2: Complete login after OAuth callback.
 * Takes the JWT from the URL hash, fetches ZK proof, derives address.
 */
export async function completeZkLogin(params: {
  jwt: string;
}): Promise<ZkLoginSession> {
  const { jwt } = params;

  // Restore ephemeral keypair from session
  const secretKeyStr = sessionStorage.getItem(EPHEMERAL_KEY_PAIR_KEY);
  const randomness = sessionStorage.getItem(RANDOMNESS_KEY);
  const maxEpochStr = sessionStorage.getItem(MAX_EPOCH_KEY);

  if (!secretKeyStr || !randomness || !maxEpochStr) {
    throw new Error("Missing zkLogin session data. Please start login again.");
  }

  const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeyStr);
  const maxEpoch = Number(maxEpochStr);

  // Get ephemeral public key
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralKeypair.getPublicKey(),
  );

  // Decode JWT to extract claims
  const decoded = decodeJwt(jwt);

  // Derive deterministic salt from user's sub claim
  const salt = deriveSalt(decoded.sub);

  // Fetch ZK proof via Mysten public prover
  const proof = await fetchZkProof({
    jwt,
    ephemeralPublicKey: extendedEphemeralPublicKey,
    maxEpoch,
    randomness,
    salt,
  });

  // Compute addressSeed from salt + JWT claims
  const addressSeed = genAddressSeed(
    BigInt(salt),
    "sub",
    decoded.sub,
    decoded.aud,
  ).toString();

  const zkProof: ZkLoginSignatureInputs = { ...proof, addressSeed };

  // Derive zkLogin address from addressSeed
  const finalAddress = computeZkLoginAddressFromSeed(
    BigInt(addressSeed),
    decoded.iss,
  );

  return {
    address: finalAddress,
    ephemeralKeypair,
    maxEpoch,
    randomness,
    jwt,
    userSalt: salt,
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
 * Save auth session to sessionStorage for persistence across page refreshes.
 */
export function saveAuthSession(params: {
  address: string;
  maxEpoch: number;
  zkProof: ZkLoginSignatureInputs;
}): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      address: params.address,
      maxEpoch: params.maxEpoch,
      zkProof: params.zkProof,
    }),
  );
}

/**
 * Restore auth session from sessionStorage.
 * Returns null if no session or if data is invalid.
 */
export function restoreAuthSession(): {
  address: string;
  ephemeralKeypair: Ed25519Keypair;
  maxEpoch: number;
  zkProof: ZkLoginSignatureInputs;
} | null {
  if (typeof window === "undefined") return null;

  const secretKeyStr = sessionStorage.getItem(EPHEMERAL_KEY_PAIR_KEY);
  const sessionStr = sessionStorage.getItem(AUTH_SESSION_KEY);

  if (!secretKeyStr || !sessionStr) return null;

  try {
    const session = JSON.parse(sessionStr);
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(secretKeyStr);
    return {
      address: session.address,
      ephemeralKeypair,
      maxEpoch: session.maxEpoch,
      zkProof: session.zkProof,
    };
  } catch {
    return null;
  }
}

/**
 * Clear all zkLogin session data from sessionStorage.
 */
export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(EPHEMERAL_KEY_PAIR_KEY);
  sessionStorage.removeItem(RANDOMNESS_KEY);
  sessionStorage.removeItem(MAX_EPOCH_KEY);
}
