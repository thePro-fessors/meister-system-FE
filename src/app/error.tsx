"use client";

import { SystemMessage } from "@/components/SystemMessage";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SystemMessage code="오류" title="화면을 불러오지 못했습니다" description="잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.">
    {error.digest && <p className="w-full text-xs text-ink-soft">오류 식별자: {error.digest}</p>}
    <button onClick={() => retry()} className="text-sm font-semibold text-brass hover:underline">다시 시도</button>
  </SystemMessage>;
}
