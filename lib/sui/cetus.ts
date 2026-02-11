import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { getSuiClient } from "./client";
import { SUI_NETWORK, SUI_TYPE, getUsdcType } from "@/lib/constants";

let cetusClient: AggregatorClient | null = null;

function getCetusEnv(): Env {
  return SUI_NETWORK === "mainnet" ? Env.Mainnet : Env.Testnet;
}

/**
 * Get or create a singleton AggregatorClient for Cetus DEX aggregation.
 * Unlike DeepBook, Cetus client is not per-address (stateless routing).
 */
export function getCetusClient(): AggregatorClient {
  if (!cetusClient) {
    cetusClient = new AggregatorClient({
      client: getSuiClient(),
      env: getCetusEnv(),
    });
  }
  return cetusClient;
}

/** Token type addresses for each network */
export interface TokenPair {
  SUI: string;
  USDC: string;
}

/**
 * Get token type addresses for the current network.
 */
export function getTokenTypes(): TokenPair {
  return {
    SUI: SUI_TYPE,
    USDC: getUsdcType(),
  };
}
