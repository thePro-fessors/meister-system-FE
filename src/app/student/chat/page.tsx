import Link from "next/link";
import { PageHeader } from "@/components/AppShell";

export default function StudentChatPage() {
  return <>
    <PageHeader eyebrow="학생" title="역량상담 도우미" description="인증 현황과 부족한 역량, 증빙 제출 방법을 함께 확인하세요." />
    <section className="space-y-4 rounded-lg border border-line bg-paper-raised p-5">
      <h2 className="font-display font-semibold text-ink">오른쪽 아래 도우미 버튼으로 상담 시작</h2>
      <p className="text-sm text-ink-soft">이 화면은 학생 메뉴에 공통으로 제공되는 기존 상담창을 사용합니다. 버튼을 열고 질문하거나 추천 질문을 선택해 주세요.</p>
      <p className="rounded-md bg-brass-soft p-3 text-sm text-ink">현재 상담은 로컬 데이터에 기반한 내장 룰 방식입니다. AI 서버에 연결된 상담이 아니며, POST /api/ai/student/chat은 호출하지 않습니다.</p>
      <div className="flex flex-wrap gap-4 text-sm text-brass"><Link href="/student/dashboard">내 인증 현황</Link><Link href="/student/submissions/new">증빙자료 제출</Link><Link href="/student/points">상벌점 내역</Link></div>
    </section>
  </>;
}
