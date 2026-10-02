"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { StudentChatbot } from "@/components/StudentChatbot";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="student">
      {children}
      <StudentChatbot />
    </RoleGuard>
  );
}
