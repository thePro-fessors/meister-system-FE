"use client";

import { useState } from "react";
import { Mail, CheckCircle2, X } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { apiClient, apiErrorMessage } from "@/lib/api-client";

export default function ProfilePage() {
  return <RoleGuard><Profile /></RoleGuard>;
}

function Profile() {
  const { user, reloadUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 이메일 변경 및 OTP 모달 상태
  const [newEmail, setNewEmail] = useState("");
  const [emailChangeToken, setEmailChangeToken] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [passwordForEmail, setPasswordForEmail] = useState("");
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPending, setOtpPending] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

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

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailNotice(null);
    setOtpError(null);
    const target = newEmail.trim().toLowerCase();
    if (!target || !target.includes("@")) {
      setEmailError("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    if (target === (user?.email || "").toLowerCase()) {
      setEmailError("현재 사용 중인 이메일과 동일합니다.");
      return;
    }
    setOtpPending(true);
    try {
      await apiClient.request("/api/auth/send-otp", {
        method: "POST",
        body: { email: target, purpose: "change_email" },
      });
      setOtpCode("");
      setIsOtpModalOpen(true);
    } catch (err) {
      setEmailError(apiErrorMessage(err));
    } finally {
      setOtpPending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    const target = newEmail.trim().toLowerCase();
    if (!otpCode.trim()) {
      setOtpError("6자리 인증번호를 입력해 주세요.");
      return;
    }
    setOtpPending(true);
    try {
      const res = await apiClient.request<{ emailChangeToken?: string; registerToken?: string }>("/api/auth/verify-otp", {
        method: "POST",
        body: { email: target, verify_code: otpCode.trim(), purpose: "change_email" },
      });
      const token = res?.emailChangeToken || res?.registerToken;
      if (!token) throw new Error("인증 토큰을 발급받지 못했습니다.");
      setEmailChangeToken(token);
      setVerifiedEmail(target);
      setIsOtpModalOpen(false);
      setEmailNotice("이메일 인증이 완료되었습니다. 현재 비밀번호를 입력하여 변경을 완료해 주세요.");
    } catch (err) {
      setOtpError(apiErrorMessage(err));
    } finally {
      setOtpPending(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailNotice(null);
    if (!verifiedEmail || !emailChangeToken) {
      setEmailError("먼저 이메일 OTP 인증을 완료해 주세요.");
      return;
    }
    if (!passwordForEmail) {
      setEmailError("현재 계정 비밀번호를 입력해 주세요.");
      return;
    }
    setEmailPending(true);
    try {
      await apiClient.request("/api/auth/email", {
        method: "PATCH",
        body: {
          email: verifiedEmail,
          password: passwordForEmail,
          email_change_token: emailChangeToken,
        },
      });
      setEmailNotice("이메일이 성공적으로 변경되었습니다.");
      setNewEmail("");
      setVerifiedEmail(null);
      setEmailChangeToken(null);
      setPasswordForEmail("");
      await reloadUser();
    } catch (err) {
      setEmailError(apiErrorMessage(err));
    } finally {
      setEmailPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="내 프로필" description="계정과 소속 정보를 확인하고 비밀번호 및 이메일을 변경할 수 있습니다." />
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 비밀번호 변경 */}
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

        {/* 이메일 변경 */}
        <section className="rounded-lg border border-line bg-paper-raised p-6">
          <h2 className="font-display text-base font-semibold text-ink">이메일 변경</h2>
          <p className="mt-1 text-xs text-ink-soft">
            새 이메일 주소로 인증번호(OTP)를 전송하여 확인 후 변경합니다.
          </p>
          {emailNotice && <p role="status" className="mt-3 rounded-md bg-certified-soft px-3 py-2 text-sm text-certified">{emailNotice}</p>}
          {emailError && <p role="alert" className="mt-3 rounded-md bg-alert-soft px-3 py-2 text-sm text-alert">{emailError}</p>}

          {!verifiedEmail ? (
            <form onSubmit={handleRequestOtp} className="mt-4 grid max-w-md gap-3">
              <div>
                <label htmlFor="newEmail" className="block text-xs font-medium text-ink">새 이메일 주소</label>
                <input
                  id="newEmail"
                  type="email"
                  required
                  placeholder="new-email@school.hs.kr"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brass"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={otpPending}
                  className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
                >
                  {otpPending ? "인증번호 발송 중..." : "인증번호 발송"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleEmailChange} className="mt-4 grid max-w-md gap-3">
              <div>
                <label className="block text-xs font-medium text-ink">인증된 새 이메일</label>
                <div className="mt-1 flex items-center justify-between rounded-md border border-certified bg-certified-soft px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-certified">
                    <CheckCircle2 size={16} /> {verifiedEmail}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setVerifiedEmail(null); setEmailChangeToken(null); }}
                    className="text-xs text-ink-soft underline hover:text-ink"
                  >
                    재입력
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="passwordForEmail" className="block text-xs font-medium text-ink">현재 비밀번호 확인</label>
                <input
                  id="passwordForEmail"
                  type="password"
                  required
                  placeholder="현재 비밀번호를 입력하세요"
                  value={passwordForEmail}
                  onChange={(e) => setPasswordForEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brass"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={emailPending}
                  className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-ink disabled:opacity-50"
                >
                  {emailPending ? "변경 처리 중..." : "이메일 변경 완료"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* OTP 인증 모달 (관리자 초대코드 모달 디자인 계승) */}
      {isOtpModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl border border-line bg-paper-raised p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
                  <Mail size={16} />
                </span>
                <div>
                  <h2 id="otp-dialog-title" className="font-display text-base font-semibold text-ink">이메일 인증번호 확인</h2>
                  <p className="text-xs text-ink-soft">{newEmail}으로 발송된 코드를 입력하세요.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOtpModalOpen(false)}
                className="rounded-md p-1.5 text-ink-soft hover:bg-paper hover:text-ink"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            {otpError && <p role="alert" className="mt-4 rounded-md bg-alert-soft p-3 text-xs text-alert">{otpError}</p>}
            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
              <div>
                <p id="otp-hint" className="mb-1 text-xs text-ink-soft">이메일로 수신된 6자리 번호를 5분 이내에 입력해 주세요.</p>
                <input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  aria-describedby="otp-hint"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-center font-mono text-xl font-bold tracking-widest outline-none focus:border-brass"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOtpModalOpen(false)}
                  className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-paper"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={otpPending}
                  className="rounded-md bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-ink disabled:opacity-50"
                >
                  {otpPending ? "확인 중..." : "인증 확인"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
