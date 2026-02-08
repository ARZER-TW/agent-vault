import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getSuiClient } from "@/lib/sui/client";
import { fromBase64 } from "@mysten/sui/utils";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

const SignAndExecuteSchema = z.object({
  txBytes: z.string().min(1),
  userSignature: z.string().min(1),
});

/**
 * POST /api/sponsor/sign-and-execute
 *
 * Receives pre-built transaction bytes (base64, from Transaction.sign())
 * and the user's zkLogin signature. Co-signs with sponsor key and executes.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(getClientKey(req.headers), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${secs} seconds.` },
      { status: 429 },
    );
  }

  try {
    const body = await req.json();
    const { txBytes, userSignature } = SignAndExecuteSchema.parse(body);

    const sponsorKeyStr = process.env.SPONSOR_PRIVATE_KEY?.trim();
    if (!sponsorKeyStr) {
      return NextResponse.json(
        { success: false, error: "Sponsor wallet not configured" },
        { status: 500 },
      );
    }

    const sponsorKeypair = Ed25519Keypair.fromSecretKey(sponsorKeyStr);
    const client = getSuiClient();

    const txBytesArray = fromBase64(txBytes);
    const sponsorSig = await sponsorKeypair.signTransaction(txBytesArray);

    const result = await client.executeTransactionBlock({
      transactionBlock: txBytesArray,
      signature: [userSignature, sponsorSig.signature],
      options: { showEffects: true },
    });

    if (result.effects?.status?.status !== "success") {
      const errorMsg =
        result.effects?.status?.error ?? "Transaction execution failed";
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, digest: result.digest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid request parameters", details: error.errors },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
