import { SystemMessage } from "@/components/SystemMessage";

export default function ForbiddenPage() {
  return <SystemMessage code="접근 제한" title="접근 권한이 없습니다" description="현재 계정으로 이 화면을 이용할 수 없습니다. 담당 권한이 필요한 경우 관리자에게 문의해 주세요." />;
}
