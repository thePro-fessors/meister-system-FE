import AdminDashboard from "../dashboard/page";
import { AiServicePanel } from "@/components/AiServicePanel";

export default function OverviewPage() {
  return <><AdminDashboard /><AiServicePanel title="AI 운영 리포트" endpoint="/api/ai/admin/summary-report" description="전교생 통계를 바탕으로 학교 운영 보고서 요약과 지도 인사이트를 생성합니다." action="운영 브리핑 생성" /></>;
}
