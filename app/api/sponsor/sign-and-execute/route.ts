import { NextRequest, NextResponse } from "next/server";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getSuiClient } from "@/lib/sui/client";
import { fromBase64 } from "@mysten/sui/utils";

/**
 * POST /api/sponsor/sign-and-execute
 *
 * Receives pre-built transaction bytes (base64, from Transaction.sign())
 * and the user's zkLogin signature. Co-signs with sponsor key and executes.
 *
 * Body: { txBytes: string (base64), userSignature: string (zkLogin sig) }
 */
export async function POST(req: NextRequest) {
  try {
    const { txBytes, userSignature } = await req.json();

    if (!txBytes || !userSignature) {
      return NextResponse.json(
        { error: "Missing txBytes or userSignature" },
        { status: 400 },
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
    const client = getSuiClient();

    // Decode transaction bytes from base64
    const txBytesArray = fromBase64(txBytes);

    // Sponsor signs the transaction (same bytes the user signed)
    const sponsorSig = await sponsorKeypair.signTransaction(txBytesArray);

    // Execute with both signatures: user (zkLogin) first, then sponsor
    const result = await client.executeTransactionBlock({
      transactionBlock: txBytesArray,
      signature: [userSignature, sponsorSig.signature],
      options: { showEffects: true },
    });

    if (result.effects?.status?.status !== "success") {
      const errorMsg =
        result.effects?.status?.error ?? "Transaction execution failed";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.json({ digest: result.digest });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("[sponsor/sign-and-execute] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
