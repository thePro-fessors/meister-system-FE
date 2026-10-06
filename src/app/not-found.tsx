import { SystemMessage } from "@/components/SystemMessage";

export default function NotFound() {
  return <SystemMessage code="404" title="페이지를 찾을 수 없습니다" description="주소가 올바른지 확인하거나 내 화면으로 돌아가 주세요." />;
}
