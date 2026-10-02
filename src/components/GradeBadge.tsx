const STYLES: Record<string, string> = {
  S: "bg-navy text-white border-navy",
  A: "bg-brass-soft text-brass border-brass",
  B: "bg-amber-soft text-amber border-amber",
  미달성: "bg-alert-soft text-alert border-alert",
};

export function GradeBadge({ grade }: { grade: string }) {
  const style = STYLES[grade] ?? "bg-navy-soft text-ink-soft border-line";
  return (
    <span
      aria-label={`등급: ${grade}`}
      title={grade}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border font-display text-sm font-semibold ${style}`}
    >
      {grade === "미달성" ? "-" : grade}
    </span>
  );
}
