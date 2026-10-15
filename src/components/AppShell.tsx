"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Role } from "@/lib/types";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  Star,
  Upload,
  Users,
  CalendarRange,
  Gauge,
  MessageCircle,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: "/student/dashboard", label: "내 인증 현황", icon: LayoutDashboard },
    { href: "/student/submissions/new", label: "증빙자료 제출", icon: Upload },
    { href: "/student/submissions", label: "제출 내역", icon: ClipboardList },
    { href: "/student/points", label: "상벌점 내역", icon: Star },
    { href: "/student/chat", label: "역량인증 도우미", icon: MessageCircle },
  ],
  teacher: [
    { href: "/teacher/chat", label: "학급 지도 도우미", icon: Users },
    { href: "/teacher/dashboard", label: "교사 대시보드", icon: LayoutDashboard },
    { href: "/teacher/students", label: "학생 자료 조회", icon: Users },
    { href: "/teacher/points", label: "상벌점 관리", icon: Star },
  ],
  admin: [
    { href: "/admin/ai/audit", label: "AI 이상치 감사", icon: ShieldCheck },
    { href: "/admin/overview", label: "전체 현황", icon: Gauge },
    { href: "/teacher/dashboard", label: "증빙 심사", icon: ClipboardList },
    { href: "/teacher/students", label: "학생 자료 조회", icon: Users },
    { href: "/teacher/points", label: "상벌점 관리", icon: Star },
    { href: "/admin/years", label: "학년도 관리", icon: CalendarRange },
    { href: "/admin/criteria", label: "기준 · 배점 관리", icon: Settings2 },
    { href: "/admin/batch", label: "일괄 등록 · 내보내기", icon: Upload },
    { href: "/admin/audit", label: "감사 로그", icon: ClipboardList },
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

  if (!user) return null;

  const items = [...NAV[user.role], { href: "/profile", label: "내 프로필", icon: Users }];

  return (
    <div className="app-frame flex min-h-screen flex-col md:flex-row">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-4">본문으로 건너뛰기</a>
      <aside className="app-sidebar flex w-full flex-shrink-0 flex-col border-r border-line md:w-60">
        <div className="flex items-center gap-3 px-5 py-5 md:py-8">
          <span className="brand-mark"><ShieldCheck size={24} strokeWidth={1.75} /></span>
          <div>
            <p className="font-display text-base font-bold leading-tight text-ink">마이스터</p>
            <p className="mt-1 text-xs text-ink-soft">역량인증 기록부</p>
          </div>
        </div>

        <nav aria-label="주요 메뉴" className="flex scroll-px-4 gap-1 overflow-x-auto px-4 py-4 md:flex-1 md:flex-col md:overflow-visible md:px-3 md:py-5">
          {items.map((item) => {
            const active = pathname === item.href || (pathname.startsWith(`${item.href}/`) && !items.some(
              (other) => other.href !== item.href && other.href.startsWith(`${item.href}/`) && pathname.startsWith(other.href)
            ));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                 href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-3 text-sm transition-colors ${
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

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 md:block md:py-5">
          <div className="rounded-md px-2 py-1 md:mb-3">
            <p className="text-sm font-medium text-ink">{user.name}</p>
            <p className="text-xs text-ink-soft">
              {ROLE_LABEL[user.role]}
              {user.role === "student" && ` · ${user.grade}학년 ${user.classNo}반 ${user.number}번`}
              {user.role === "teacher" && user.homeroom && ` · 담임 (${user.homeroom})`}
            </p>
          </div>
          <button
            onClick={() => { if (window.confirm("로그아웃하시겠습니까?")) void logout(); }}
            disabled={pending}
            aria-busy={pending}
            className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-alert-soft hover:text-alert md:w-full"
          >
            <LogOut size={16} strokeWidth={1.75} />
            로그아웃
          </button>
          {error && <p role="alert" className="px-2 text-xs text-alert">{error}</p>}
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-7 pb-28 sm:px-8 lg:px-12 lg:pt-12">{children}</div>
      </main>
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
      {eyebrow && <p className="mb-2 text-sm font-medium text-ink-soft">{eyebrow}</p>}
      <h1 className="font-display font-bold text-ink">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-ink-soft">{description}</p>}
    </div>
  );
}
