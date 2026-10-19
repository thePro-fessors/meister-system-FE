"use client";

import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/AppShell";
import { AiServicePanel } from "@/components/AiServicePanel";

export default function TeacherChatPage() {
  const { user } = useAuth();
  if (user?.role !== "teacher") return <p role="alert">학급 지도 도우미는 교사 전용입니다.</p>;
  return (
    <div>
      <PageHeader
        title="학급 지도 도우미"
        description={`${user.homeroom || "담당 범위"} · 학생의 취약 영역과 지도 방안을 확인하세요.`}
      />
      <AiServicePanel
        title="학급 분석 상담"
        endpoint="/api/ai/teacher/chat"
        description="담당 학급 및 권한 범위 내 학생 데이터를 기반으로 취약 영역과 미달성 항목 맞춤형 지도 방안을 분석합니다."
        action="상담 시작"
        presets={["우리 반 정보처리기능사 미취득자", "취약 영역 지도법", "인성 영역 보완 필요 학생 명단"]}
      />
    </div>
  );
}
