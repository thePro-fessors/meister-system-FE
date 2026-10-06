"use client";

import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/AppShell";
import { AiServicePanel } from "@/components/AiServicePanel";

export default function TeacherChatPage() {
  const { user } = useAuth();
  if (user?.role !== "teacher") return <p role="alert">학급 지도 도우미는 교사 전용입니다.</p>;
  return <div>
    <PageHeader title="학급 지도 도우미" description={`${user.homeroom || "담당 범위"} · 학생의 취약 영역과 지도 방안을 확인하세요.`} />
    <AiServicePanel title="학급 분석 상담" endpoint="/api/ai/teacher/chat" description="담당 범위 내 자료만 활용하여 취약 영역과 미달성 항목을 분석합니다. 타 학급 접근 차단은 서버에서 검증해야 합니다." action="상담 시작" />
    <div className="flex flex-wrap gap-2" aria-label="추천 질문">
      {["우리 반 정보처리기능사 미취득자", "취약 영역 지도법"].map((text) => <span key={text} className="rounded-full border border-line px-3 py-2 text-sm text-ink-soft">{text}</span>)}
    </div>
  </div>;
}
