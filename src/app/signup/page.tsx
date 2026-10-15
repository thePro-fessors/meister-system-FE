"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { AuthError } from "@/lib/auth-service";

const inputClass = "mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass";

export default function SignupPage() {
  const { user, loading } = useAuth();
  const { registerStudent, registerTeacher } = useData();
  const router = useRouter();
  const submitted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(`/${user.role}/dashboard`);
  }, [loading, user, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || user || submitted.current) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("confirmPassword")) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    submitted.current = true;
    setPending(true);
    try {
      const account = {
        id: String(form.get("id") ?? ""),
        name: String(form.get("name") ?? ""),
        password,
      };
      if (role === "teacher") {
        await registerTeacher({ ...account, invitationCode: String(form.get("invitationCode") ?? "") });
      } else {
        registerStudent({
          ...account,
          grade: Number(form.get("grade")),
          classNo: Number(form.get("classNo")),
          number: Number(form.get("number")),
        });
      }
      setComplete(true);
    } catch (cause) {
      submitted.current = false;
      setError(cause instanceof AuthError ? cause.message : "회원가입에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-layout">
      <div className="login-form-panel">
        <div className="w-full max-w-sm">
          {complete ? (
            <div role="status">
              <h1 className="font-display text-3xl font-bold text-ink">가입이 완료됐어요</h1>
              <p className="mt-3 text-sm text-ink-soft">등록한 아이디와 비밀번호로 로그인해 주세요.</p>
              <Link href="/login" className="mt-8 block rounded-lg bg-brass py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-navy">로그인하러 가기</Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-display text-3xl font-bold text-ink">회원가입</h1>
                <p className="mt-3 text-sm text-ink-soft">학생 또는 교사 계정을 만들어 주세요.</p>
              </div>
              <p id="demo-notice" className="mb-6 rounded-md bg-brass-soft px-3 py-3 text-xs leading-6 text-ink-soft">
                체험용 가입입니다. 계정과 비밀번호는 현재 브라우저에 암호화 없이 저장되며, 데이터 초기화 시 삭제됩니다. 실제 사용하는 비밀번호나 개인정보는 입력하지 마세요.
                {role === "teacher" && " 초대 코드는 서버에서 확인하며 저장하지 않습니다. 교사 담당 업무와 학급은 가입 시 부여되지 않습니다."}
              </p>
              <form onSubmit={handleSubmit} aria-describedby="demo-notice" aria-busy={pending}>
                <fieldset disabled={loading || !!user || pending} className="space-y-4 disabled:opacity-60">
                  <div>
                    <label htmlFor="role" className="text-sm font-medium text-ink">가입 유형</label>
                    <select id="role" value={role} onChange={(event) => { setRole(event.target.value === "teacher" ? "teacher" : "student"); setError(null); }} className={inputClass}>
                      <option value="student">학생</option>
                      <option value="teacher">교사</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="name" className="text-sm font-medium text-ink">이름</label>
                    <input id="name" name="name" autoComplete="name" required maxLength={50} placeholder="이름 입력" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="id" className="text-sm font-medium text-ink">아이디</label>
                    <input id="id" name="id" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={4} maxLength={20} pattern="[A-Za-z0-9_]{4,20}" aria-describedby="id-help" className={inputClass} />
                    <p id="id-help" className="mt-1 text-xs text-ink-soft">영문, 숫자, 밑줄(_)로 4~20자</p>
                  </div>
                  {role === "student" ? <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="grade" className="text-sm font-medium text-ink">학년</label>
                      <select id="grade" name="grade" defaultValue="1" className={inputClass}>
                        {[1, 2, 3].map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="classNo" className="text-sm font-medium text-ink">반</label>
                      <input id="classNo" name="classNo" type="number" min={1} max={99} required className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="number" className="text-sm font-medium text-ink">번호</label>
                      <input id="number" name="number" type="number" min={1} max={99} required className={inputClass} />
                    </div>
                  </div> : <div>
                    <label htmlFor="invitationCode" className="text-sm font-medium text-ink">교사 초대 코드</label>
                    <input id="invitationCode" name="invitationCode" type="password" autoComplete="off" required maxLength={256} aria-describedby="code-help" className={inputClass} />
                    <p id="code-help" className="mt-1 text-xs text-ink-soft">관리자가 발급한 초대 코드를 입력해 주세요. 코드는 관리자에게 문의해 주세요.</p>
                  </div>}
                  <div>
                    <label htmlFor="password" className="text-sm font-medium text-ink">비밀번호</label>
                    <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} aria-describedby="password-help" className={inputClass} />
                    <p id="password-help" className="mt-1 text-xs text-ink-soft">8자 이상 입력해 주세요.</p>
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-ink">비밀번호 확인</label>
                    <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputClass} />
                  </div>
                  {error && <p role="alert" className="rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}
                  <button type="submit" className="w-full rounded-lg bg-brass py-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy">{pending ? "가입 처리 중..." : loading ? "세션 확인 중..." : "회원가입"}</button>
                </fieldset>
              </form>
              <p className="mt-6 text-center text-sm text-ink-soft">
                이미 계정이 있나요?{" "}
                <Link href="/login" className="font-semibold text-brass hover:underline">로그인</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
