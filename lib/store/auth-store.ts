import { create } from "zustand";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { ZkLoginSignatureInputs } from "@mysten/sui/zklogin";

interface AuthState {
  address: string | null;
  ephemeralKeypair: Ed25519Keypair | null;
  maxEpoch: number | null;
  zkProof: ZkLoginSignatureInputs | null;
  isLoggedIn: boolean;
  login: (params: {
    address: string;
    ephemeralKeypair: Ed25519Keypair;
    maxEpoch: number;
    zkProof: ZkLoginSignatureInputs;
  }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  address: null,
  ephemeralKeypair: null,
  maxEpoch: null,
  zkProof: null,
  isLoggedIn: false,
  login: (params) =>
    set({
      address: params.address,
      ephemeralKeypair: params.ephemeralKeypair,
      maxEpoch: params.maxEpoch,
      zkProof: params.zkProof,
      isLoggedIn: true,
    }),
  logout: () =>
    set({
      address: null,
      ephemeralKeypair: null,
      maxEpoch: null,
      zkProof: null,
      isLoggedIn: false,
    }),
}));
