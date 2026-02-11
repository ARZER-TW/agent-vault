import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Cetus client
vi.mock("@/lib/sui/cetus", () => ({
  getCetusClient: vi.fn(() => ({
    findRouters: vi.fn(() =>
      Promise.resolve({
        paths: [{ path: "mock-route" }],
        amountOut: { toString: () => "1500000" },
        insufficientLiquidity: false,
      }),
    ),
    routerSwap: vi.fn(() => Promise.resolve("mockOutputCoin")),
  })),
  getTokenTypes: vi.fn(() => ({
    SUI: "0x2::sui::SUI",
    USDC: "0x14a71d857b34677a7d57e0feb303df1adb515a37780645ab763d42ce8d1a5e48::usdc::USDC",
  })),
}));

// Mock Stablelayer client
vi.mock("@/lib/sui/stablelayer", () => ({
  getStableLayerClient: vi.fn(() => ({
    buildMintTx: vi.fn(() => Promise.resolve()),
    buildBurnTx: vi.fn(() => Promise.resolve()),
    buildClaimTx: vi.fn(() => Promise.resolve()),
  })),
  STABLELAYER_AVAILABLE: true,
}));

import {
  buildAgentCetusSwap,
  buildAgentStableMint,
  buildAgentStableBurn,
  buildAgentStableClaim,
} from "../ptb-agent";

const ADDR_OWNER =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const ADDR_AGENT =
  "0x0000000000000000000000000000000000000000000000000000000000000002";

describe("buildAgentCetusSwap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Transaction for valid swap params", async () => {
    const tx = await buildAgentCetusSwap({
      vaultId: "0xvault1",
      agentCapId: "0xcap1",
      ownerAddress: ADDR_OWNER,
      amountMist: 500_000_000n,
    });

    expect(tx).toBeDefined();
  });

  it("accepts custom slippage", async () => {
    const tx = await buildAgentCetusSwap({
      vaultId: "0xvault1",
      agentCapId: "0xcap1",
      ownerAddress: ADDR_OWNER,
      amountMist: 1_000_000_000n,
      slippage: 0.005,
    });

    expect(tx).toBeDefined();
  });
});

describe("buildAgentStableMint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Transaction for valid mint params", async () => {
    const tx = await buildAgentStableMint({
      vaultId: "0xvault1",
      agentCapId: "0xcap1",
      agentAddress: ADDR_AGENT,
      ownerAddress: ADDR_OWNER,
      amountMist: 500_000_000n,
    });

    expect(tx).toBeDefined();
  });
});

describe("buildAgentStableBurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Transaction for valid burn params", async () => {
    const tx = await buildAgentStableBurn({
      agentAddress: ADDR_AGENT,
      ownerAddress: ADDR_OWNER,
    });

    expect(tx).toBeDefined();
  });

  it("handles burnAll flag", async () => {
    const tx = await buildAgentStableBurn({
      agentAddress: ADDR_AGENT,
      ownerAddress: ADDR_OWNER,
      burnAll: true,
    });

    expect(tx).toBeDefined();
  });
});

describe("buildAgentStableClaim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Transaction for valid claim params", async () => {
    const tx = await buildAgentStableClaim({
      agentAddress: ADDR_AGENT,
      ownerAddress: ADDR_OWNER,
    });

    expect(tx).toBeDefined();
  });
});
