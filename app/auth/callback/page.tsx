"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { completeZkLogin, deriveUserSalt } from "@/lib/auth/zklogin";
import { decodeJwt } from "@mysten/sui/zklogin";

const statusConfig: Record<string, { color: string; pulse: boolean }> = {
  processing: { color: "text-accent", pulse: true },
  verifying: { color: "text-accent", pulse: true },
  fetching: { color: "text-accent", pulse: true },
  success: { color: "text-emerald-400", pulse: false },
  error: { color: "text-red-400", pulse: false },
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing login...");

  useEffect(() => {
    async function handleCallback() {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const jwt = params.get("id_token");

        if (!jwt) {
          setStatus("error");
          setMessage("No token received from Google.");
          return;
        }

        setStatus("verifying");
        setMessage("Verifying token...");

        const decoded = decodeJwt(jwt);
        const sub = decoded.sub;
        if (!sub) {
          setStatus("error");
          setMessage("Invalid token - missing sub claim.");
          return;
        }

        const userSalt = deriveUserSalt(sub);

        setStatus("fetching");
        setMessage("Fetching ZK proof...");

        const session = await completeZkLogin({ jwt, userSalt });

        login({
          address: session.address,
          ephemeralKeypair: session.ephemeralKeypair,
          maxEpoch: session.maxEpoch,
          zkProof: session.zkProof,
        });

        setStatus("success");
        setMessage("Login successful! Redirecting...");
        router.push("/vault");
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Login failed";
        setStatus("error");
        setMessage(msg);
      }
    }

    handleCallback();
  }, [login, router]);

  const config = statusConfig[status] ?? statusConfig.processing;

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute inset-0 section-gradient" />

      <div className="relative glass-card p-12 text-center max-w-sm mx-auto">
        {/* Animated vault icon */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border border-accent/20 animate-ring-rotate" />
          <div className="absolute inset-2 rounded-full border border-amber/15 animate-ring-rotate-reverse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-accent"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>

        <h1 className="font-display font-bold text-xl text-white mb-3">
          zkLogin
        </h1>

        <div className="flex items-center justify-center gap-2">
          {config.pulse && (
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          )}
          {status === "success" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {status === "error" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
          <p className={`text-sm ${config.color}`}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
