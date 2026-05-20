export default function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'warn' | 'good';
}) {
  const ring =
    tone === 'warn'
      ? 'border-amber-300'
      : tone === 'good'
        ? 'border-emerald-300'
        : 'border-gray-200 dark:border-gray-700';
  return (
    <div className={`rounded-2xl border bg-white p-4 dark:bg-gray-800 ${ring}`}>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-white">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
