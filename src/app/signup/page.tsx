"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { loginDestination } from "@/lib/navigation";

const inputClass = "mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brass focus:ring-1 focus:ring-brass disabled:opacity-50";

export default function SignupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<"student" | "teacher" | "admin">("student");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState(1);
  const [classNo, setClassNo] = useState(1);
  const [number, setNumber] = useState(1);
  const [adminCode, setAdminCode] = useState("");

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [registerToken, setRegisterToken] = useState("");

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(loginDestination(user.role));
  }, [loading, user, router]);

  async function handleSendOtp() {
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError(role === "admin" ? "이메일 주소를 입력해 주세요." : "학교 이메일 주소를 입력해 주세요.");
      return;
    }
    if (role !== "admin" && !trimmedEmail.endsWith("@bssm.hs.kr")) {
      setError("학교 이메일(@bssm.hs.kr)만 가입할 수 있습니다.");
      return;
    }
    if (role === "admin" && !adminCode.trim()) {
      setError("관리자 등록 코드를 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      const payload: Record<string, any> = {
        email: trimmedEmail,
        purpose: "register",
        is_it_student: role === "student",
      };
      if (role === "student") {
        payload.student_grade = grade;
        payload.student_class = classNo;
        payload.student_number = number;
      } else if (role === "admin") {
        payload.admin_code = adminCode.trim();
      }
      await apiClient.request("/api/auth/send-otp", {
        method: "POST",
        body: payload,
        authenticated: false,
      });
      setOtpSent(true);
      setInfo("이메일로 6자리 인증번호가 발송되었습니다. 확인 후 입력해 주세요.");
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setInfo(null);
    if (!otpCode.trim()) {
      setError("인증번호를 입력해 주세요.");
      return;
    }
    setPending(true);
    try {
      const res = await apiClient.request<{ registerToken?: string; register_token?: string }>("/api/auth/verify-otp", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          verify_code: otpCode.trim(),
          purpose: "register",
        },
        authenticated: false,
      });
      const token = res.registerToken || res.register_token;
      if (!token) throw new Error("인증 토큰을 발급받지 못했습니다.");
      setRegisterToken(token);
      setOtpVerified(true);
      setInfo("이메일 인증이 완료되었습니다. 사용할 아이디와 비밀번호를 입력해 주세요.");
    } catch (cause) {
      setError(apiErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  async function handleFinalRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!id.trim() || id.length < 4 || id.length > 20) {
      setError("아이디는 4~20자로 입력해 주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setPending(true);
    try {
      await apiClient.request("/api/auth/register", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          id: id.trim(),
          password,
          register_token: registerToken,
          admin_code: role === "admin" ? adminCode.trim() : undefined,
        },
        authenticated: false,
      });
      setComplete(true);
    } catch (cause) {
      setError(apiErrorMessage(cause));
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
              <Link href="/login" className="mt-8 block rounded-lg bg-brass py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-navy">
                로그인하러 가기
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-display text-3xl font-bold text-ink">회원가입</h1>
                <p className="mt-3 text-sm text-ink-soft">부산소프트웨어마이스터고 인증 시스템 계정을 생성합니다.</p>
              </div>

              {info && <p role="status" className="mb-4 rounded-md bg-certified-soft px-3 py-2 text-sm text-certified">{info}</p>}
              {error && <p role="alert" className="mb-4 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{error}</p>}

              {!otpVerified ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="role" className="text-sm font-medium text-ink">가입 유형</label>
                    <select
                      id="role"
                      disabled={otpSent || pending}
                      value={role}
                      onChange={(e) => {
                        setRole(e.target.value as any);
                        setError(null);
                        setInfo(null);
                      }}
                      className={inputClass}
                    >
                      <option value="student">학생</option>
                      <option value="teacher">교사</option>
                      <option value="admin">관리자</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="email" className="text-sm font-medium text-ink">
                      {role === "admin" ? "이메일" : "학교 이메일 (@bssm.hs.kr)"}
                    </label>
                    <input
                      id="email"
                      type="email"
                      disabled={otpSent || pending}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={role === "admin" ? "admin@example.com" : "user@bssm.hs.kr"}
                      className={inputClass}
                    />
                  </div>

                  {role === "student" && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="grade" className="text-sm font-medium text-ink">학년</label>
                        <select
                          id="grade"
                          disabled={otpSent || pending}
                          value={grade}
                          onChange={(e) => setGrade(Number(e.target.value))}
                          className={inputClass}
                        >
                          <option value={1}>1학년</option>
                          <option value={2}>2학년</option>
                          <option value={3}>3학년</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="classNo" className="text-sm font-medium text-ink">반</label>
                        <input
                          id="classNo"
                          type="number"
                          min={1}
                          max={99}
                          disabled={otpSent || pending}
                          value={classNo}
                          onChange={(e) => setClassNo(Number(e.target.value))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="number" className="text-sm font-medium text-ink">번호</label>
                        <input
                          id="number"
                          type="number"
                          min={1}
                          max={99}
                          disabled={otpSent || pending}
                          value={number}
                          onChange={(e) => setNumber(Number(e.target.value))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {role === "admin" && (
                    <div>
                      <label htmlFor="adminCode" className="text-sm font-medium text-ink">관리자 등록 코드</label>
                      <input
                        id="adminCode"
                        type="password"
                        disabled={otpSent || pending}
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        placeholder="관리자 전용 코드"
                        className={inputClass}
                      />
                    </div>
                  )}

                  {!otpSent ? (
                    <button
                      type="button"
                      disabled={pending || !email}
                      onClick={handleSendOtp}
                      className="w-full rounded-lg bg-brass py-3 text-sm font-semibold text-white transition-colors hover:bg-navy disabled:opacity-50"
                    >
                      {pending ? "인증번호 발송 중..." : "인증번호 발송"}
                    </button>
                  ) : (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label htmlFor="otpCode" className="text-sm font-medium text-ink">인증번호 6자리</label>
                        <input
                          id="otpCode"
                          type="text"
                          maxLength={6}
                          disabled={pending}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="123456"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={handleVerifyOtp}
                          className="flex-1 rounded-lg bg-brass py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy disabled:opacity-50"
                        >
                          {pending ? "확인 중..." : "인증번호 확인"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => { setOtpSent(false); setOtpCode(""); }}
                          className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink hover:bg-paper-raised"
                        >
                          재전송
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleFinalRegister} className="space-y-4">
                  <div>
                    <label htmlFor="id" className="text-sm font-medium text-ink">사용할 아이디</label>
                    <input
                      id="id"
                      required
                      minLength={4}
                      maxLength={20}
                      disabled={pending}
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      placeholder="영문, 숫자 4~20자"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="text-sm font-medium text-ink">비밀번호</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        disabled={pending}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8자 이상 (영문, 숫자, 특수문자)"
                        className={`${inputClass} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                        className="absolute right-2.5 top-[calc(50%+3px)] -translate-y-1/2 rounded p-1 text-ink-soft hover:text-ink"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-ink">비밀번호 확인</label>
                    <input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      disabled={pending}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호 재입력"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-lg bg-brass py-3.5 text-sm font-semibold text-white transition-colors hover:bg-navy disabled:opacity-50"
                  >
                    {pending ? "가입 처리 중..." : "회원가입 완료"}
                  </button>
                </form>
              )}

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
