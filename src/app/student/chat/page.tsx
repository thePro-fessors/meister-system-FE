import Link from "next/link";
import { PageHeader } from "@/components/AppShell";

export default function StudentChatPage() {
  return <>
    <PageHeader eyebrow="학생" title="역량상담 도우미" description="인증 현황과 부족한 역량, 증빙 제출 방법을 함께 확인하세요." />
    <section className="space-y-4 rounded-lg border border-line bg-paper-raised p-5">
      <h2 className="font-display font-semibold text-ink">오른쪽 아래 도우미 버튼으로 AI 맞춤 상담 시작</h2>
      <p className="text-sm text-ink-soft">화면 우측 하단의 AI 도우미 버튼을 열어 마이스터 역량인증제 상담을 진행할 수 있습니다. 본인의 인증 취득 점수, 미달성 역량 보완 방법, 증빙자료 작성 팁 등을 AI에게 자유롭게 질문해 보세요.</p>
      <div className="flex flex-wrap gap-4 text-sm text-brass"><Link href="/student/dashboard">내 인증 현황</Link><Link href="/student/submissions/new">증빙자료 제출</Link><Link href="/student/points">상벌점 내역</Link></div>
    </section>
  </>;
}
