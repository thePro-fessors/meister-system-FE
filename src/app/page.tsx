"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace(`/${user.role}/dashboard`);
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="font-display text-ink-soft">불러오는 중…</p>
    </div>
  );
}
