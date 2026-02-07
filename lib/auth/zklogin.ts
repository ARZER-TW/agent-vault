import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  genAddressSeed,
  getZkLoginSignature,
  decodeJwt,
  computeZkLoginAddressFromSeed,
} from "@mysten/sui/zklogin";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";
import { getSuiClient } from "@/lib/sui/client";
import { SUI_NETWORK } from "@/lib/constants";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? "http://localhost:3000/auth/callback";

// Enoki API (recommended, works for testnet/mainnet)
const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY ?? "";
const ENOKI_URL = "https://api.enoki.mystenlabs.com/v1/zklogin/zkp";

// Legacy prover (fallback only)
const LEGACY_PROVER_URL =
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
 * Fetch ZK proof via Enoki API.
 */
async function fetchProofEnoki(params: {
  jwt: string;
  ephemeralPublicKey: string;
  maxEpoch: number;
  randomness: string;
  salt: string;
}): Promise<ZkLoginSignatureInputs> {
  const response = await fetch(ENOKI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ENOKI_API_KEY}`,
      "zklogin-jwt": params.jwt,
    },
    body: JSON.stringify({
      network: SUI_NETWORK,
      ephemeralPublicKey: params.ephemeralPublicKey,
      maxEpoch: params.maxEpoch,
      randomness: params.randomness,
      salt: params.salt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Enoki prover error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  return json.data as ZkLoginSignatureInputs;
}

/**
 * Fetch ZK proof via legacy Mysten prover (fallback).
 */
async function fetchProofLegacy(params: {
  jwt: string;
  extendedEphemeralPublicKey: string;
  maxEpoch: number;
  randomness: string;
  salt: string;
}): Promise<ZkLoginSignatureInputs> {
  let lastError = "";
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(LEGACY_PROVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jwt: params.jwt,
        extendedEphemeralPublicKey: params.extendedEphemeralPublicKey,
        maxEpoch: params.maxEpoch,
        jwtRandomness: params.randomness,
        salt: params.salt,
        keyClaimName: "sub",
      }),
    });

    if (response.ok) {
      return (await response.json()) as ZkLoginSignatureInputs;
    }

    lastError = await response.text();
    const isTransient =
      lastError.includes("fetch failed") ||
      response.status === 429 ||
      response.status >= 500;

    if (!isTransient || attempt === MAX_RETRIES - 1) break;
    await new Promise((r) => setTimeout(r, 6000));
  }

  throw new Error(`Legacy prover error: ${lastError}`);
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

  // Get ephemeral public key in both formats
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralKeypair.getPublicKey(),
  );

  // Decode JWT for addressSeed computation
  const decoded = decodeJwt(jwt);
  const aud = typeof decoded.aud === "string" ? decoded.aud : decoded.aud[0];

  // Fetch ZK proof -- prefer legacy prover for consistent addressSeed control,
  // fallback to Enoki if legacy fails
  let zkProof: ZkLoginSignatureInputs;
  let finalAddress = address;
  let usedEnoki = false;

  try {
    zkProof = await fetchProofLegacy({
      jwt,
      extendedEphemeralPublicKey,
      maxEpoch,
      randomness,
      salt: userSalt,
    });

    // Legacy prover: compute our own addressSeed (matches our salt)
    const computedSeed = genAddressSeed(
      BigInt(userSalt),
      "sub",
      decoded.sub,
      aud,
    ).toString();

    zkProof = { ...zkProof, addressSeed: computedSeed };
    console.log("[zklogin] Legacy prover: addressSeed:", computedSeed);
  } catch (legacyError) {
    console.warn("[zklogin] Legacy prover failed, trying Enoki:", legacyError);

    if (!ENOKI_API_KEY) {
      throw legacyError;
    }

    zkProof = await fetchProofEnoki({
      jwt,
      ephemeralPublicKey: extendedEphemeralPublicKey,
      maxEpoch,
      randomness,
      salt: userSalt,
    });
    usedEnoki = true;

    // Enoki returns its own addressSeed that may differ from ours.
    // The ZK proof is bound to Enoki's addressSeed, so we MUST use it.
    if (zkProof.addressSeed) {
      finalAddress = computeZkLoginAddressFromSeed(
        BigInt(zkProof.addressSeed),
        decoded.iss,
      );
      console.log("[zklogin] Enoki addressSeed:", zkProof.addressSeed);
      console.log("[zklogin] Enoki-derived address:", finalAddress);
    } else {
      // Enoki didn't return addressSeed, compute our own
      const computedSeed = genAddressSeed(
        BigInt(userSalt),
        "sub",
        decoded.sub,
        aud,
      ).toString();
      zkProof = { ...zkProof, addressSeed: computedSeed };
    }
  }

  console.log("[zklogin] Prover:", usedEnoki ? "Enoki" : "Legacy");
  console.log("[zklogin] Final address:", finalAddress);
  console.log("[zklogin] addressSeed:", zkProof.addressSeed);

  // Store salt for future sessions
  if (typeof window !== "undefined") {
    sessionStorage.setItem(USER_SALT_KEY, userSalt);
  }

  return {
    address: finalAddress,
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
