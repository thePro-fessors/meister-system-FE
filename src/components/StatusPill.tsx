const STYLES: Record<string, string> = {
  제출완료: "bg-navy-soft text-navy",
  검토중: "bg-amber-soft text-amber",
  인정완료: "bg-certified-soft text-certified",
  반려: "bg-alert-soft text-alert",
  재제출요청: "bg-alert-soft text-alert",
  "인증 가능": "bg-certified-soft text-certified",
  미달성: "bg-alert-soft text-alert",
  "보완 필요": "bg-amber-soft text-amber",
  상점: "bg-certified-soft text-certified",
  벌점: "bg-alert-soft text-alert",
  충족: "bg-certified-soft text-certified",
};

export function StatusPill({ label }: { label: string }) {
  const style = STYLES[label] ?? "bg-navy-soft text-ink-soft";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
