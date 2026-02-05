"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { completeZkLogin, deriveUserSalt } from "@/lib/auth/zklogin";
import { decodeJwt } from "@mysten/sui/zklogin";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [status, setStatus] = useState("Processing login...");

  useEffect(() => {
    async function handleCallback() {
      try {
        // Extract id_token from URL hash fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const jwt = params.get("id_token");

        if (!jwt) {
          setStatus("Error: No token received from Google.");
          return;
        }

        setStatus("Verifying token...");

        // Decode JWT to get sub claim for salt derivation
        const decoded = decodeJwt(jwt);
        const sub = decoded.sub;
        if (!sub) {
          setStatus("Error: Invalid token - missing sub claim.");
          return;
        }

        const userSalt = deriveUserSalt(sub);

        setStatus("Fetching ZK proof...");

        const session = await completeZkLogin({ jwt, userSalt });

        login({
          address: session.address,
          ephemeralKeypair: session.ephemeralKeypair,
          maxEpoch: session.maxEpoch,
          zkProof: session.zkProof,
        });

        setStatus("Login successful! Redirecting...");
        router.push("/vault");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Login failed";
        setStatus(`Error: ${message}`);
      }
    }

    handleCallback();
  }, [login, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-bold text-white mb-4">zkLogin</h1>
        <p className="text-gray-400">{status}</p>
      </div>
    </div>
  );
}
