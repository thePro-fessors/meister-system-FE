import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { StudentChatbot } from "@/components/StudentChatbot";

export default function StudentChatPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="학생"
        title="역량인증 도우미"
        description="인증 현황과 부족한 역량, 증빙 제출 방법을 AI 도우미와 대화하며 확인하세요."
      />
      <StudentChatbot embedded />
      <div className="flex flex-wrap gap-4 text-sm text-brass">
        <Link href="/student/dashboard" className="hover:underline">내 인증 현황 바로가기</Link>
        <Link href="/student/submissions/new" className="hover:underline">증빙자료 제출 바로가기</Link>
        <Link href="/student/points" className="hover:underline">상벌점 내역 바로가기</Link>
      </div>
    </div>
  );
}
