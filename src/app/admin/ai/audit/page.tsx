import { PageHeader } from "@/components/AppShell";
import { AiServicePanel } from "@/components/AiServicePanel";

export default function AuditPage() {
  return (
    <div>
      <PageHeader title="AI 이상치 감사" description="중복 의심 증빙과 급변 점수를 탐지하고 검토합니다." />
      <AiServicePanel
        title="이상치 탐지"
        endpoint="/api/ai/admin/audit-anomalies"
        description="위험도(High / Medium / Low), 관련 증빙과 의심 사유를 확인합니다. 탐지 결과만으로 부정 제출을 확정하지 않습니다."
        action="이상치 분석 실행"
        emptyMessage="아직 분석을 실행하지 않았습니다. 버튼을 눌러 이상치 탐지를 시작하세요."
      />
    </div>
  );
}
