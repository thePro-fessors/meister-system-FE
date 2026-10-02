"use client";

import { RoleGuard } from "@/components/RoleGuard";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard role="teacher">{children}</RoleGuard>;
}
