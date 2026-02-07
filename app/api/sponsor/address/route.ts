import { NextResponse } from "next/server";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

/**
 * GET /api/sponsor/address
 *
 * Returns the sponsor wallet's Sui address.
 * This is needed client-side to set gasOwner on transactions.
 */
export async function GET() {
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
