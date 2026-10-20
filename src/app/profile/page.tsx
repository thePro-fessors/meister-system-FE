"use client";

import { useState } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

export default function ProfilePage() {
  return <RoleGuard><Profile /></RoleGuard>;
}

function Profile() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;
  const role = { student: "학생", teacher: "교사", admin: "관리자" }[user.role];

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    if (!currentPassword || !newPassword) {
      setError("현재 비밀번호와 새 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiClient.request<{ token?: string }>("/api/auth/password", {
        method: "PATCH",
        body: {
          currentPassword,
          newPassword,
        },
      });
      if (res && typeof res === "object" && typeof res.token === "string" && res.token) {
        localStorage.setItem("meister_access_token", res.token);
      }
      setNotice("비밀번호가 성공적으로 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="내 프로필" description="계정과 소속 정보를 확인하고 비밀번호를 변경할 수 있습니다." />
      <dl className="grid gap-5 rounded-lg border border-line bg-paper-raised p-6 sm:grid-cols-2">
        {Object.entries({
          이름: user.name,
          아이디: user.id,
          역할: role,
          소속:
            user.role === "student"
              ? `${user.grade ?? "-"}학년 ${user.classNo ?? "-"}반 ${user.number ?? "-"}번`
              : user.homeroom || "전교생 담당",
        }).map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="mt-1 font-medium text-ink">{value}</dd>
          </div>
        ))}
        {user.email && (
          <div>
            <dt className="text-sm text-ink-soft">이메일</dt>
            <dd className="mt-1 font-medium text-ink">{user.email}</dd>
          </div>
        )}
      </dl>

      <section className="rounded-lg border border-line bg-paper-raised p-6">
        <h2 className="font-display text-base font-semibold text-ink">비밀번호 변경</h2>
        <p className="mt-1 text-xs text-ink-soft">
          영문, 숫자, 특수문자 3종 조합 8자 이상(또는 2종 조합 10자 이상)으로 설정해 주세요.
        </p>
        {notice && <p role="status" className="mt-3 rounded-md bg-certified-soft px-3 py-2 text-sm text-certified">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
        <form onSubmit={handlePasswordChange} className="mt-4 grid max-w-md gap-3">
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-medium text-ink">현재 비밀번호</label>
            <input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-xs font-medium text-ink">새 비밀번호</label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-ink">새 비밀번호 확인</label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brass"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
            >
              {busy ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
