import Link from "next/link";

export function SystemMessage({ code, title, description, children }: {
  code: string; title: string; description: string; children?: React.ReactNode;
}) {
  return <main className="flex min-h-screen items-center justify-center bg-paper p-6">
    <section className="w-full max-w-lg rounded-lg border border-line bg-paper-raised p-8">
      <p className="text-sm font-semibold text-brass">{code}</p>
      <h1 className="mt-3 font-display text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-3 text-sm text-ink-soft">{description}</p>
      <div className="mt-6 flex flex-wrap gap-4">
        {children}
        <Link href="/" className="text-sm font-semibold text-brass hover:underline">내 화면으로 돌아가기</Link>
      </div>
    </section>
  </main>;
}
