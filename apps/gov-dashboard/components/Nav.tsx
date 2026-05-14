import Link from "next/link";

const LINKS = [
  { href: "/overview", label: "수요 개요" },
  { href: "/coverage-gaps", label: "정책 사각지대" },
  { href: "/by-region", label: "지역별" },
];

export function Nav() {
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-6">
        <Link href="/overview" className="text-xl font-bold">
          FIN:NECT · 정책 수요 대시보드
        </Link>
        <nav className="flex gap-4 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
