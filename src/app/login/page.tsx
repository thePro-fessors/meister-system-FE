"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const DEMO_ACCOUNTS = [
  { id: "student1", label: "학생 · 김민준", role: "학생" },
  { id: "teacher1", label: "교사 · 박정훈", role: "교사" },
  { id: "admin1", label: "관리자", role: "관리자" },
];

export default function LoginPage() {
  const { user, loading, pending, login } = useAuth();
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace(`/${user.role}/dashboard`);
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
      <section className="login-intro" aria-labelledby="intro-title">
        <div className="flex items-center gap-3">
          <span className="brand-mark"><ShieldCheck size={24} strokeWidth={1.75} /></span>
          <p className="text-sm font-semibold text-ink">마이스터역량인증제</p>
        </div>
        <div className="relative z-10 py-4 lg:py-12">
          <h1 id="intro-title" className="login-heading text-ink">배운 것에서<br />해낸 것으로.</h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-ink-soft">자격증, 프로젝트, 봉사와 독서까지.<br />학교에서 쌓은 경험을 나만의 역량 기록으로 남기세요.</p>
          <ul className="login-record" aria-label="기록할 수 있는 역량">
            <li><span>직업기초능력</span><span>협업과 문제 해결</span></li>
            <li><span>전문기술역량</span><span>자격증과 프로젝트</span></li>
            <li><span>인성/직업의식</span><span>봉사와 학교생활</span></li>
            <li><span>인문학적 소양</span><span>독서와 인문 활동</span></li>
            <li><span>외국어 능력</span><span>언어와 소통</span></li>
          </ul>
        </div>
      </section>
      <div className="login-form-panel">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h2 className="font-display text-3xl font-bold text-ink">내 기록 시작하기</h2>
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
            placeholder="student1 / teacher1 / admin1"
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
            placeholder="1234"
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

        <div className="mt-9 border-t border-line pt-6">
          <p className="mb-2.5 text-xs font-medium text-ink-soft">체험용 계정 (비밀번호 1234)</p>
          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.id}
                disabled={pending || loading}
                type="button"
                onClick={() => {
                  setId(acc.id);
                  setPassword("1234");
                }}
                className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-left text-sm transition-colors hover:border-brass hover:bg-brass-soft/40"
              >
                <span className="text-ink">{acc.label}</span>
                <span className="text-xs text-ink-soft">{acc.id}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
