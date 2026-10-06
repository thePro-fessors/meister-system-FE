"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Role } from "@/lib/types";
import { AppShell } from "./AppShell";
import { canAccessRole } from "@/lib/navigation";

export function RoleGuard({
  role,
  children,
}: {
  role?: Role;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !!user && (!role || canAccessRole(user.role, role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname + window.location.search)}`);
      return;
    }
    if (!allowed) {
      router.replace("/forbidden");
    }
  }, [user, loading, allowed, router, pathname]);

  if (loading || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="font-display text-ink-soft">
          {loading ? "불러오는 중…" : "접근 권한을 확인하는 중…"}
        </p>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
