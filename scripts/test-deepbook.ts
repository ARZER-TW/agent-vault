/**
 * Test DeepBook V3 on Testnet.
 * Run: npx tsx scripts/test-deepbook.ts
 */
import { DeepBookClient } from "@mysten/deepbook-v3";
import { SuiClient } from "@mysten/sui/client";

const TESTNET_RPC = "https://fullnode.testnet.sui.io:443";
const POOL_KEY = "SUI_DBUSDC";

// Use a dummy address for read-only operations
const DUMMY_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000001";

async function main() {
  const suiClient = new SuiClient({ url: TESTNET_RPC });
  const dbClient = new DeepBookClient({
    client: suiClient,
    address: DUMMY_ADDRESS,
    env: "testnet",
  });

  console.log("=== DeepBook V3 Testnet Diagnostics ===\n");

  // 1. Check if pool is whitelisted (whitelisted = no DEEP fee)
  try {
    const whitelisted = await dbClient.whitelisted(POOL_KEY);
    console.log(`[1] Pool whitelisted: ${whitelisted}`);
    if (whitelisted) {
      console.log("    -> No DEEP token needed for fees");
    } else {
      console.log("    -> DEEP token required for swap fees");
    }
  } catch (e) {
    console.log(`[1] whitelisted check failed: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Get mid price
  try {
    const mid = await dbClient.midPrice(POOL_KEY);
    console.log(`[2] Mid price: ${mid}`);
    if (mid === 0) {
      console.log("    -> WARNING: Mid price is 0 (no orders?)");
    }
  } catch (e) {
    console.log(`[2] midPrice failed: ${e instanceof Error ? e.message : e}`);
  }

  // 3. Get order book ticks
  try {
    const level2 = await dbClient.getLevel2TicksFromMid(POOL_KEY, 5);
    console.log(`[3] Order book ticks:`);
    console.log(`    Bids: ${level2.bid_prices.length} levels`);
    if (level2.bid_prices.length > 0) {
      console.log(`    Best bid: ${level2.bid_prices[0]} qty: ${level2.bid_quantities[0]}`);
    }
    console.log(`    Asks: ${level2.ask_prices.length} levels`);
    if (level2.ask_prices.length > 0) {
      console.log(`    Best ask: ${level2.ask_prices[0]} qty: ${level2.ask_quantities[0]}`);
    }
    if (level2.bid_prices.length === 0 && level2.ask_prices.length === 0) {
      console.log("    -> WARNING: Empty order book -- no liquidity");
    }
  } catch (e) {
    console.log(`[3] getLevel2TicksFromMid failed: ${e instanceof Error ? e.message : e}`);
  }

  // 4. Get swap quote for 0.1 SUI
  try {
    const quote = await dbClient.getQuoteQuantityOut(POOL_KEY, 0.1);
    console.log(`[4] Swap quote (0.1 SUI -> DBUSDC):`);
    console.log(`    Quote out: ${quote.quoteOut}`);
    console.log(`    DEEP required: ${quote.deepRequired}`);
    if (quote.quoteOut === 0) {
      console.log("    -> WARNING: Quote output is 0 (no liquidity to fill)");
    }
  } catch (e) {
    console.log(`[4] getQuoteQuantityOut failed: ${e instanceof Error ? e.message : e}`);
  }

  // 5. Pool trade params
  try {
    const tradeParams = await dbClient.poolTradeParams(POOL_KEY);
    console.log(`[5] Pool trade params:`, JSON.stringify(tradeParams, null, 2));
  } catch (e) {
    console.log(`[5] poolTradeParams failed: ${e instanceof Error ? e.message : e}`);
  }

  console.log("\n=== Done ===");
}

main().catch(console.error);
