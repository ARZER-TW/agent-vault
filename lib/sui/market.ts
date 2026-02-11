import BN from "bn.js";
import { getCetusClient, getTokenTypes } from "./cetus";

export interface OrderBookSnapshot {
  bidPrices: number[];
  bidQuantities: number[];
  askPrices: number[];
  askQuantities: number[];
  midPrice: number;
  poolKey: string;
  timestamp: number;
  source: "live" | "fallback";
}

export interface CetusQuote {
  amountIn: bigint;
  expectedOut: bigint;
  priceImpact: number;
  source: "cetus" | "fallback";
}

// Fallback: SUI ~ $1.50 USDC, bid/ask spread ~0.5%
const FALLBACK_MID_PRICE = 1.5;
const FALLBACK_SPREAD = 0.005;
const ESTIMATED_SPREAD = 0.003; // 0.3% estimated spread for synthetic order book

// 1 SUI in MIST for price discovery
const PRICE_PROBE_AMOUNT = new BN("1000000000");

// Decimals
const SUI_DECIMALS = 9;
const USDC_DECIMALS = 6;

function buildFallbackOrderBook(poolKey: string): OrderBookSnapshot {
  const mid = FALLBACK_MID_PRICE;
  const halfSpread = mid * FALLBACK_SPREAD * 0.5;
  const bestBid = mid - halfSpread;
  const bestAsk = mid + halfSpread;

  return {
    bidPrices: [bestBid, bestBid - 0.005, bestBid - 0.01],
    bidQuantities: [500, 1000, 2000],
    askPrices: [bestAsk, bestAsk + 0.005, bestAsk + 0.01],
    askQuantities: [500, 1000, 2000],
    midPrice: mid,
    poolKey,
    timestamp: Date.now(),
    source: "fallback",
  };
}

/**
 * Build a synthetic order book from a mid price.
 * Since Cetus is an AMM aggregator (not an order book), we derive
 * synthetic bid/ask levels from the mid price with estimated spread.
 */
function buildSyntheticOrderBook(
  midPrice: number,
  poolKey: string,
): OrderBookSnapshot {
  const halfSpread = midPrice * ESTIMATED_SPREAD * 0.5;
  const bestBid = midPrice - halfSpread;
  const bestAsk = midPrice + halfSpread;

  return {
    bidPrices: [bestBid, bestBid - 0.005, bestBid - 0.01],
    bidQuantities: [500, 1000, 2000],
    askPrices: [bestAsk, bestAsk + 0.005, bestAsk + 0.01],
    askQuantities: [500, 1000, 2000],
    midPrice,
    poolKey,
    timestamp: Date.now(),
    source: "live",
  };
}

/**
 * Fetch order book snapshot using Cetus Aggregator.
 * Uses a small probe swap (1 SUI -> USDC) to derive the mid price,
 * then builds a synthetic order book from it.
 *
 * The `address` param is kept for backward compatibility but is unused
 * since the Cetus aggregator client is stateless.
 */
export async function getOrderBook(
  _address: string,
  poolKey: string = "SUI_USDC",
): Promise<OrderBookSnapshot> {
  try {
    const client = getCetusClient();
    const tokens = getTokenTypes();

    const routers = await client.findRouters({
      from: tokens.SUI,
      target: tokens.USDC,
      amount: PRICE_PROBE_AMOUNT,
      byAmountIn: true,
    });

    if (!routers || routers.insufficientLiquidity) {
      console.warn(
        "[market] Cetus returned no routes or insufficient liquidity, using fallback",
      );
      return buildFallbackOrderBook(poolKey);
    }

    // amountOut is USDC (6 decimals) for 1 SUI (9 decimals) input
    const amountOutRaw = BigInt(routers.amountOut.toString());
    const midPrice = Number(amountOutRaw) / Math.pow(10, USDC_DECIMALS);

    if (midPrice <= 0) {
      console.warn("[market] Cetus returned zero price, using fallback");
      return buildFallbackOrderBook(poolKey);
    }

    return buildSyntheticOrderBook(midPrice, poolKey);
  } catch (error) {
    console.warn(
      "[market] Cetus price fetch failed, using fallback data:",
      error instanceof Error ? error.message : String(error),
    );
    return buildFallbackOrderBook(poolKey);
  }
}

/**
 * Get a swap quote from the Cetus Aggregator.
 * Returns the expected output amount and price impact for a given input.
 */
export async function getCetusQuote(params: {
  fromType: string;
  targetType: string;
  amountIn: bigint;
}): Promise<CetusQuote> {
  const { fromType, targetType, amountIn } = params;

  try {
    const client = getCetusClient();

    const routers = await client.findRouters({
      from: fromType,
      target: targetType,
      amount: new BN(amountIn.toString()),
      byAmountIn: true,
    });

    if (!routers || routers.insufficientLiquidity) {
      console.warn("[market] Cetus quote: no routes or insufficient liquidity");
      return buildFallbackQuote(amountIn, fromType, targetType);
    }

    const expectedOut = BigInt(routers.amountOut.toString());

    // Calculate price impact from deviation ratio (provided by Cetus)
    const priceImpact =
      typeof routers.deviationRatio === "number"
        ? routers.deviationRatio
        : 0;

    return {
      amountIn,
      expectedOut,
      priceImpact,
      source: "cetus",
    };
  } catch (error) {
    console.warn(
      "[market] Cetus quote failed, using fallback:",
      error instanceof Error ? error.message : String(error),
    );
    return buildFallbackQuote(amountIn, fromType, targetType);
  }
}

/**
 * Build a fallback quote using the static fallback mid price.
 */
function buildFallbackQuote(
  amountIn: bigint,
  fromType: string,
  targetType: string,
): CetusQuote {
  const tokens = getTokenTypes();

  let expectedOut: bigint;

  if (fromType === tokens.SUI && targetType === tokens.USDC) {
    // SUI -> USDC: convert MIST to SUI, multiply by price, convert to USDC units
    const suiAmount = Number(amountIn) / Math.pow(10, SUI_DECIMALS);
    const usdcAmount = suiAmount * FALLBACK_MID_PRICE;
    expectedOut = BigInt(Math.floor(usdcAmount * Math.pow(10, USDC_DECIMALS)));
  } else if (fromType === tokens.USDC && targetType === tokens.SUI) {
    // USDC -> SUI: convert to USDC, divide by price, convert to MIST
    const usdcAmount = Number(amountIn) / Math.pow(10, USDC_DECIMALS);
    const suiAmount = usdcAmount / FALLBACK_MID_PRICE;
    expectedOut = BigInt(Math.floor(suiAmount * Math.pow(10, SUI_DECIMALS)));
  } else {
    // Unknown pair: return zero output with fallback source
    expectedOut = 0n;
  }

  return {
    amountIn,
    expectedOut,
    priceImpact: 0,
    source: "fallback",
  };
}
