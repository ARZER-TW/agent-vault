import { create } from "zustand";
import type { VaultData, OwnerCapData, AgentCapData, AgentLogEntry } from "@/lib/vault/types";
import type { AgentDecision } from "@/lib/agent/intent-parser";
import type { PolicyCheckResult } from "@/lib/agent/policy-checker";

export interface PendingProposal {
  decision: AgentDecision;
  policyCheck: PolicyCheckResult;
  timestamp: number;
}

interface VaultState {
  vaults: VaultData[];
  ownerCaps: OwnerCapData[];
  agentCaps: AgentCapData[];
  selectedVaultId: string | null;
  agentLogs: AgentLogEntry[];
  isLoading: boolean;
  pendingProposal: PendingProposal | null;
  setVaults: (vaults: VaultData[]) => void;
  setOwnerCaps: (caps: OwnerCapData[]) => void;
  setAgentCaps: (caps: AgentCapData[]) => void;
  selectVault: (id: string | null) => void;
  addAgentLog: (log: AgentLogEntry) => void;
  clearAgentLogs: () => void;
  setLoading: (loading: boolean) => void;
  setPendingProposal: (proposal: PendingProposal | null) => void;
  clearPendingProposal: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  vaults: [],
  ownerCaps: [],
  agentCaps: [],
  selectedVaultId: null,
  agentLogs: [],
  isLoading: false,
  pendingProposal: null,
  setVaults: (vaults) => set({ vaults }),
  setOwnerCaps: (caps) => set({ ownerCaps: caps }),
  setAgentCaps: (caps) => set({ agentCaps: caps }),
  selectVault: (id) => set({ selectedVaultId: id }),
  addAgentLog: (log) =>
    set((state) => ({ agentLogs: [log, ...state.agentLogs].slice(0, 50) })),
  clearAgentLogs: () => set({ agentLogs: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setPendingProposal: (proposal) => set({ pendingProposal: proposal }),
  clearPendingProposal: () => set({ pendingProposal: null }),
}));
