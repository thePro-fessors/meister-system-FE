import SubmitPage from "../../submit/page";
import { AiServicePanel } from "@/components/AiServicePanel";

export default function NewSubmissionPage() {
  return <><AiServicePanel title="AI 항목 추천" endpoint="/api/ai/classify-submission" description="활동명과 설명을 바탕으로 적합한 영역과 항목을 추천합니다. 아래 기존 추천은 서버 AI가 아닌 로컬 키워드 데모입니다." action="서버 AI 추천" /><SubmitPage /></>;
}
