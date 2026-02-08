import { NextRequest, NextResponse } from "next/server";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

/**
 * GET /api/sponsor/address
 *
 * Returns the sponsor wallet's Sui address.
 * This is needed client-side to set gasOwner on transactions.
 */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${secs} seconds.` },
      { status: 429 },
    );
  }

  const sponsorKeyStr = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorKeyStr) {
    return NextResponse.json(
      { error: "Sponsor wallet not configured" },
      { status: 500 },
    );
  }

  const sponsorKeypair = Ed25519Keypair.fromSecretKey(sponsorKeyStr);
  const address = sponsorKeypair.getPublicKey().toSuiAddress();

  return NextResponse.json({ address });
}
