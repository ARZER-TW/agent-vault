import { getDeepBookClient } from "./deepbook";

const DEFAULT_POOL_KEY = "SUI_DBUSDC";

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

export interface SwapQuote {
  baseQuantity: number;
  quoteOut: number;
  deepRequired: number;
}

// Fallback: SUI ~ $1.50 USDC, bid/ask spread ~0.5%
const FALLBACK_MID_PRICE = 1.5;
const FALLBACK_SPREAD = 0.005;

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
 * Fetch order book snapshot from DeepBook.
 * Falls back to estimated data if the API call fails.
 */
export async function getOrderBook(
  address: string,
  poolKey: string = DEFAULT_POOL_KEY,
  ticks: number = 20,
): Promise<OrderBookSnapshot> {
  try {
    const client = getDeepBookClient(address);

    const [level2, mid] = await Promise.all([
      client.getLevel2TicksFromMid(poolKey, ticks),
      client.midPrice(poolKey),
    ]);

    return {
      bidPrices: level2.bid_prices,
      bidQuantities: level2.bid_quantities,
      askPrices: level2.ask_prices,
      askQuantities: level2.ask_quantities,
      midPrice: mid,
      poolKey,
      timestamp: Date.now(),
      source: "live",
    };
  } catch (error) {
    console.warn(
      "[market] DeepBook API failed, using fallback data:",
      error instanceof Error ? error.message : String(error),
    );
    return buildFallbackOrderBook(poolKey);
  }
}

/**
 * Get estimated quote output for a base swap (sell SUI -> get DBUSDC).
 */
export async function getSwapQuote(
  address: string,
  baseQuantity: number,
  poolKey: string = DEFAULT_POOL_KEY,
): Promise<SwapQuote> {
  const client = getDeepBookClient(address);
  const result = await client.getQuoteQuantityOut(poolKey, baseQuantity);

  return {
    baseQuantity: result.baseQuantity,
    quoteOut: result.quoteOut,
    deepRequired: result.deepRequired,
  };
}


