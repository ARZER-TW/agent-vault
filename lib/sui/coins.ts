import { getSuiClient } from "./client";

export interface CoinItem {
  objectId: string;
  balance: bigint;
}

/**
 * Fetch all SUI coin objects owned by an address.
 */
export async function getSuiCoins(ownerAddress: string): Promise<CoinItem[]> {
  const client = getSuiClient();
  const coins: CoinItem[] = [];
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const params: { owner: string; coinType: string; cursor?: string } = {
      owner: ownerAddress,
      coinType: "0x2::sui::SUI",
    };
    if (cursor) {
      params.cursor = cursor;
    }

    const page = await client.getCoins(params);

    for (const coin of page.data) {
      coins.push({
        objectId: coin.coinObjectId,
        balance: BigInt(coin.balance),
      });
    }

    cursor = page.nextCursor ?? null;
    hasNext = page.hasNextPage;
  }

  // Sort by balance descending so largest coin is first
  return coins.sort((a, b) => (b.balance > a.balance ? 1 : -1));
}
