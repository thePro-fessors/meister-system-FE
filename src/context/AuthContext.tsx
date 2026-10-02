"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "@/lib/types";
import { AuthError } from "@/lib/auth-service";
import { useData } from "./DataContext";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  pending: boolean;
  error: string | null;
  login: (id: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { authService } = useData();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const router = useRouter();

  useEffect(() => {
    const version = generation;
    const request = ++version.current;
    authService.restore().then((restored) => {
      if (request === generation.current) setUser(restored);
    }).catch(() => {
      if (request === generation.current) {
        setUser(null);
        setError("세션을 확인하지 못했습니다. 다시 로그인해 주세요.");
      }
    }).finally(() => {
      if (request === generation.current) setLoading(false);
    });
    return () => { version.current++; };
  }, [authService]);

  const login: AuthContextValue["login"] = async (id, password) => {
    if (busy.current || loading) return { ok: false, message: "로그인 처리 중입니다. 잠시 기다려 주세요." };
    busy.current = true;
    const request = ++generation.current;
    setPending(true);
    setError(null);
    try {
      const found = await authService.login({ username: id.trim(), password });
      if (request !== generation.current) return { ok: false };
      setUser(found);
      return { ok: true };
    } catch (cause) {
      const message = cause instanceof AuthError ? cause.message : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      if (request === generation.current) setError(message);
      return { ok: false, message };
    } finally {
      busy.current = false;
      if (request === generation.current) setPending(false);
    }
  };

  const logout = async () => {
    if (busy.current) return;
    busy.current = true;
    const request = ++generation.current;
    setPending(true);
    setError(null);
    try {
      await authService.logout();
      if (request !== generation.current) return;
      setUser(null);
      router.replace("/login");
    } catch (cause) {
      if (request === generation.current) {
        setError(cause instanceof AuthError ? cause.message : "로그아웃에 실패했습니다. 다시 시도해 주세요.");
      }
    } finally {
      busy.current = false;
      if (request === generation.current) setPending(false);
    }
  };

  return <AuthContext.Provider value={{ user, loading, pending, error, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
