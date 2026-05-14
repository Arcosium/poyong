export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {sub ? <div className="text-xs text-gray-400 mt-1">{sub}</div> : null}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-gray-200 p-5">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function ApiError({ detail }: { detail: string }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
      백엔드에 연결할 수 없습니다. <code className="font-mono">{detail}</code>
      <div className="mt-1 text-amber-700">
        백엔드가 떠 있는지, <code className="font-mono">NEXT_PUBLIC_API_BASE_URL</code> 와 Basic Auth 환경변수가 맞는지 확인하세요.
      </div>
    </div>
  );
}
