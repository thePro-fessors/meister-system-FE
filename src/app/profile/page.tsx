"use client";

import { RoleGuard } from "@/components/RoleGuard";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  return <RoleGuard><Profile /></RoleGuard>;
}

function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  const role = { student: "학생", teacher: "교사", admin: "관리자" }[user.role];
  return <div>
    <PageHeader title="내 프로필" description="계정과 소속 정보를 확인하세요." />
    <dl className="grid gap-5 rounded-lg border border-line bg-paper-raised p-6 sm:grid-cols-2">
      {Object.entries({ 이름: user.name, 아이디: user.id, 역할: role, 소속: user.role === "student"
        ? `${user.grade ?? "-"}학년 ${user.classNo ?? "-"}반 ${user.number ?? "-"}번`
        : user.homeroom || "전교생 담당" }).map(([label, value]) => <div key={label}>
        <dt className="text-sm text-ink-soft">{label}</dt><dd className="mt-1 font-medium text-ink">{value}</dd>
      </div>)}
      {user.email && (
        <div>
          <dt className="text-sm text-ink-soft">이메일</dt>
          <dd className="mt-1 font-medium text-ink">{user.email}</dd>
        </div>
      )}
    </dl>
  </div>;
}
