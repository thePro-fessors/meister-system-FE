"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Role } from "@/lib/types";
import { homeForRole } from "@/lib/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  Star,
  Upload,
  Users,
  UserCog,
  CalendarRange,
  Gauge,
  MessageCircle,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    strokeWidth?: number;
  }>;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    {
      href: "/student/dashboard",
      label: "내 인증 현황",
      icon: LayoutDashboard,
    },
    { href: "/student/submissions/new", label: "증빙자료 제출", icon: Upload },
    { href: "/student/submissions", label: "제출 내역", icon: ClipboardList },
    { href: "/student/points", label: "상벌점 내역", icon: Star },
    { href: "/student/chat", label: "역량인증 도우미", icon: MessageCircle },
  ],
  teacher: [
    {
      href: "/teacher/dashboard",
      label: "교사 대시보드",
      icon: LayoutDashboard,
    },
    { href: "/teacher/students", label: "학생 자료 조회", icon: Users },
    { href: "/teacher/points", label: "상벌점 관리", icon: Star },
    { href: "/teacher/chat", label: "학급 지도 도우미", icon: MessageCircle },
  ],
  admin: [
    { href: "/admin/overview", label: "전체 현황", icon: Gauge },
    { href: "/admin/users", label: "전체 유저 탐색", icon: UserCog },
    { href: "/teacher/dashboard", label: "증빙 심사", icon: ClipboardList },
    { href: "/teacher/students", label: "학생 자료 조회", icon: Users },
    { href: "/teacher/points", label: "상벌점 관리", icon: Star },
    { href: "/admin/years", label: "학년도 관리", icon: CalendarRange },
    { href: "/admin/criteria", label: "기준 · 배점 관리", icon: Settings2 },
    { href: "/admin/batch", label: "일괄 등록 · 내보내기", icon: Upload },
    { href: "/admin/audit", label: "감사 로그", icon: ClipboardList },
    { href: "/admin/ai/audit", label: "AI 이상치 감사", icon: ShieldCheck },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  student: "학생",
  teacher: "교사",
  admin: "관리자",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, pending, error } = useAuth();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDialogElement>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmMobileLogout, setConfirmMobileLogout] = useState(false);

  if (!user) return null;

  const items = [
    ...NAV[user.role],
    { href: "/profile", label: "내 프로필", icon: Users },
  ];
  const isActive = (href: string) =>
    pathname === href ||
    (pathname.startsWith(`${href}/`) &&
      !items.some(
        (other) =>
          other.href !== href &&
          other.href.startsWith(`${href}/`) &&
          pathname.startsWith(other.href),
      ));
  const primaryItems = NAV[user.role].slice(0, 3);
  const activeItem = items.find((item) => isActive(item.href));

  return (
    <div className="app-frame flex min-h-screen flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4"
      >
        본문으로 건너뛰기
      </a>
      <header className="mobile-header md:hidden">
        <Link
          href={homeForRole(user.role)}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="brand-mark shrink-0">
            <ShieldCheck size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ink-soft">마이스터 역량인증</p>
            <p className="truncate text-sm font-semibold">
              {activeItem?.label ?? "역량인증 기록부"}
            </p>
          </div>
          <span className="sr-only">홈으로 이동</span>
        </Link>
        <button
          type="button"
          onClick={() => menuRef.current?.showModal()}
          className="mobile-icon-button"
          aria-label="전체 메뉴 열기"
          aria-haspopup="dialog"
        >
          <Menu size={22} />
        </button>
      </header>
      <aside className="app-sidebar hidden w-60 shrink-0 flex-col border-r border-line md:flex">
        <div className="flex shrink-0 items-center gap-3 px-5 py-5 md:py-5">
          <span className="brand-mark">
            <ShieldCheck size={24} strokeWidth={1.75} />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-tight text-ink">
              마이스터
            </p>
            <p className="mt-1 text-xs text-ink-soft">역량인증 기록부</p>
          </div>
        </div>

        <nav
          aria-label="주요 메뉴"
          className="flex min-h-0 scroll-px-4 gap-0.5 overflow-x-auto px-4 py-4 md:flex-1 md:flex-col md:overflow-y-auto md:px-3 md:py-2"
        >
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-brass-soft font-semibold text-brass"
                    : "text-ink-soft hover:bg-navy-soft hover:text-ink"
                }`}
              >
                <Icon size={17} strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 py-3 md:block md:py-3">
          <div className="rounded-md px-2 py-1 md:mb-1.5">
            <p className="text-sm font-medium text-ink">{user.name}</p>
            <p className="text-xs text-ink-soft">
              {ROLE_LABEL[user.role]}
              {user.role === "student" &&
                ` · ${user.grade}학년 ${user.classNo}반 ${user.number}번`}
              {user.role === "teacher" &&
                user.homeroom &&
                ` · 담임 (${user.homeroom})`}
            </p>
          </div>
          {!confirmLogout ? (
            <button
              onClick={() => setConfirmLogout(true)}
              disabled={pending}
              aria-busy={pending}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-alert-soft hover:text-alert md:w-full"
            >
              <LogOut size={16} strokeWidth={1.75} />
              로그아웃
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2">
              <button
                onClick={() => {
                  setConfirmLogout(false);
                  void logout();
                }}
                disabled={pending}
                className="flex-1 rounded-md bg-alert px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                로그아웃 확인
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-soft hover:bg-paper-raised"
              >
                취소
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="px-2 text-xs text-alert">
              {error}
            </p>
          )}
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pb-16 md:pb-0">
        <div className="app-content mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-8 lg:px-12 lg:pt-12">
          {children}
        </div>
      </main>
      <nav className="mobile-tabbar md:hidden" aria-label="빠른 메뉴">
        {primaryItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className="mobile-tab"
          >
            <Icon size={21} strokeWidth={1.75} />
            <span>{label}</span>
          </Link>
        ))}
        <button
          type="button"
          className="mobile-tab"
          onClick={() => menuRef.current?.showModal()}
          aria-label="전체 메뉴 열기"
          aria-haspopup="dialog"
        >
          <Menu size={21} />
          <span>전체 메뉴</span>
        </button>
      </nav>
      <dialog
        ref={menuRef}
        className="mobile-menu"
        aria-labelledby="mobile-menu-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) menuRef.current?.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h2 id="mobile-menu-title" className="font-semibold">
              전체 메뉴
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {user.name} · {ROLE_LABEL[user.role]}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            className="mobile-icon-button"
            aria-label="전체 메뉴 닫기"
            onClick={() => menuRef.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        <nav aria-label="전체 메뉴" className="grid gap-1 p-3">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => menuRef.current?.close()}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm ${isActive(href) ? "bg-brass-soft font-semibold text-brass" : "text-ink"}`}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          {!confirmMobileLogout ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmMobileLogout(true)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy-soft text-sm text-ink-soft transition-colors hover:bg-alert-soft hover:text-alert"
            >
              <LogOut size={18} />
              로그아웃
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirmMobileLogout(false);
                  menuRef.current?.close();
                  void logout();
                }}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-alert text-sm font-semibold text-white hover:opacity-90"
              >
                로그아웃 확인
              </button>
              <button
                type="button"
                onClick={() => setConfirmMobileLogout(false)}
                className="flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-sm text-ink-soft hover:bg-paper-raised"
              >
                취소
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-alert">
              {error}
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="page-header">
      {eyebrow && (
        <p className="mb-2 text-sm font-medium text-ink-soft">{eyebrow}</p>
      )}
      <h1 className="font-display font-bold text-ink">{title}</h1>
      {description && (
        <p className="mt-1.5 text-sm text-ink-soft">{description}</p>
      )}
    </div>
  );
}
