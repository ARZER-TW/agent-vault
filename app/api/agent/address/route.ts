import { NextRequest, NextResponse } from "next/server";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { checkRateLimit, getClientKey } from "@/lib/rate-limiter";

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(getClientKey(request.headers), { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    const secs = Math.ceil((rl.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { success: false, error: `Rate limit exceeded. Try again in ${secs} seconds.` },
      { status: 429 },
    );
  }

  const agentKeyStr = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!agentKeyStr) {
    return NextResponse.json(
      { success: false, error: "AGENT_PRIVATE_KEY is not configured" },
      { status: 500 },
    );
  }

  const agentKeypair = Ed25519Keypair.fromSecretKey(agentKeyStr);
  const address = agentKeypair.getPublicKey().toSuiAddress();

  return NextResponse.json({ success: true, address });
}
