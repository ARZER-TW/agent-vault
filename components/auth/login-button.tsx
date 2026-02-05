"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { beginZkLogin } from "@/lib/auth/zklogin";

export function LoginButton() {
  const { isLoggedIn, address, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    try {
      setIsLoading(true);
      const url = await beginZkLogin();
      window.location.href = url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Login failed";
      alert(message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoggedIn && address) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-gray-400">{shortAddr}</span>
        <button
          onClick={logout}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
    >
      {isLoading ? "Connecting..." : "Login with Google"}
    </button>
  );
}
