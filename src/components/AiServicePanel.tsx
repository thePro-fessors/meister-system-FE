export function AiServicePanel({ title, endpoint, description, action }: {
  title: string; endpoint: string; description: string; action: string;
}) {
  return <section className="my-5 space-y-3 rounded-lg border border-line bg-paper-raised p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-display font-semibold text-ink">{title}</h2>
      <span className="rounded bg-brass-soft px-2 py-1 text-xs text-brass">서버 연동 대기</span>
    </div>
    <p className="text-sm text-ink-soft">{description}</p>
    <p className="text-xs text-ink-soft">현재 로컬 데모에서는 AI 서버를 호출하지 않습니다. 생성 결과는 담당자가 확인한 후 적용해야 합니다.</p>
    <p className="break-all text-xs text-ink-soft">POST {endpoint}</p>
    <button disabled className="rounded-md bg-navy px-4 py-2 text-sm text-white opacity-50">{action}</button>
  </section>;
}
