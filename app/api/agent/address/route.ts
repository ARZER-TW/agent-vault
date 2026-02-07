import { NextResponse } from "next/server";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export async function GET() {
  const agentKeyStr = process.env.AGENT_PRIVATE_KEY;
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
