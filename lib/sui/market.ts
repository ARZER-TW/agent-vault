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
}

export interface SwapQuote {
  baseQuantity: number;
  quoteOut: number;
  deepRequired: number;
}

/**
 * Fetch order book snapshot from DeepBook.
 */
export async function getOrderBook(
  address: string,
  poolKey: string = DEFAULT_POOL_KEY,
  ticks: number = 20,
): Promise<OrderBookSnapshot> {
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
  };
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

/**
 * Get pool trading parameters.
 */
export async function getPoolInfo(
  address: string,
  poolKey: string = DEFAULT_POOL_KEY,
) {
  const client = getDeepBookClient(address);

  const [tradeParams, bookParams, isWhitelisted] = await Promise.all([
    client.poolTradeParams(poolKey),
    client.poolBookParams(poolKey),
    client.whitelisted(poolKey),
  ]);

  return {
    ...tradeParams,
    ...bookParams,
    whitelisted: isWhitelisted,
  };
}
