const STYLES: Record<string, string> = {
  제출완료: "bg-navy-soft text-navy",
  검토중: "bg-amber-soft text-amber",
  인정완료: "bg-certified-soft text-certified",
  반려: "bg-alert-soft text-alert",
  재제출요청: "bg-alert-soft text-alert",
  이의신청: "bg-purple-100 text-purple-800",
  "인증 가능": "bg-certified-soft text-certified",
  미달성: "bg-alert-soft text-alert",
  "보완 필요": "bg-amber-soft text-amber",
  상점: "bg-certified-soft text-certified",
  벌점: "bg-alert-soft text-alert",
  충족: "bg-certified-soft text-certified",
  정상: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "삭제 대기": "bg-rose-50 text-rose-700 border border-rose-200",
  학생: "bg-sky-50 text-sky-700 border border-sky-200",
  교사: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  관리자: "bg-purple-50 text-purple-700 border border-purple-200",
};

export function StatusPill({ label }: { label: string }) {
  const style = STYLES[label] ?? "bg-navy-soft text-ink-soft";
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
