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
  let cursor: string | null | undefined = undefined;
  let hasNext = true;

  while (hasNext) {
    const page = await client.getCoins({
      owner: ownerAddress,
      coinType: "0x2::sui::SUI",
      cursor,
    });

    for (const coin of page.data) {
      coins.push({
        objectId: coin.coinObjectId,
        balance: BigInt(coin.balance),
      });
    }

    cursor = page.nextCursor;
    hasNext = page.hasNextPage;
  }

  // Sort by balance descending so largest coin is first
  return coins.sort((a, b) => (b.balance > a.balance ? 1 : -1));
}
