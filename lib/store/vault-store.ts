import { create } from "zustand";
import type { VaultData, OwnerCapData, AgentCapData } from "@/lib/vault/types";
import type { AgentRunResult } from "@/lib/agent/runtime";

interface VaultState {
  vaults: VaultData[];
  ownerCaps: OwnerCapData[];
  agentCaps: AgentCapData[];
  selectedVaultId: string | null;
  agentLogs: AgentRunResult[];
  isLoading: boolean;
  setVaults: (vaults: VaultData[]) => void;
  setOwnerCaps: (caps: OwnerCapData[]) => void;
  setAgentCaps: (caps: AgentCapData[]) => void;
  selectVault: (id: string | null) => void;
  addAgentLog: (log: AgentRunResult) => void;
  clearAgentLogs: () => void;
  setLoading: (loading: boolean) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  vaults: [],
  ownerCaps: [],
  agentCaps: [],
  selectedVaultId: null,
  agentLogs: [],
  isLoading: false,
  setVaults: (vaults) => set({ vaults }),
  setOwnerCaps: (caps) => set({ ownerCaps: caps }),
  setAgentCaps: (caps) => set({ agentCaps: caps }),
  selectVault: (id) => set({ selectedVaultId: id }),
  addAgentLog: (log) =>
    set((state) => ({ agentLogs: [log, ...state.agentLogs].slice(0, 50) })),
  clearAgentLogs: () => set({ agentLogs: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
