"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { loginDestination } from "@/lib/navigation";

export default function LoginPage() {
  const { user, loading, pending, login } = useAuth();
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(loginDestination(user.role, new URLSearchParams(window.location.search).get("redirect")));
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || pending) return;
    setError(null);
    const result = await login(id, password);
    if (!result.ok) {
      setError(result.message ?? "로그인에 실패했습니다.");
      return;
    }
    setError(null);
  }

  return (
    <div className="login-layout">
      <div className="login-form-panel">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-ink">내 기록 시작하기</h1>
          <p className="mt-3 text-sm text-ink-soft">계정으로 로그인하면 역할에 맞는 화면이 열립니다.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-1"
        >
          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="id">
            아이디
          </label>
          <input
            id="id"
            disabled={pending || loading}
            autoComplete="username"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="아이디를 입력하세요"
            className="mb-4 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
          />

          <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="password">
            비밀번호
          </label>
          <input
            id="password"
            disabled={pending || loading}
            autoComplete="current-password"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            className="mb-2 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass"
          />

          {error && (
            <p role="alert" className="mb-2 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending || loading}
            aria-busy={pending}
            className="mt-5 w-full rounded-lg bg-brass py-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy"
          >
            {loading ? "세션 확인 중..." : pending ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          아직 계정이 없나요?{" "}
          <Link href="/signup" className="font-semibold text-brass hover:underline">회원가입</Link>
        </p>
      </div>
      </div>
    </div>
  );
}
