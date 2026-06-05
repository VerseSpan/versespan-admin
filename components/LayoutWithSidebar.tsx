"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
  { href: "/songs", label: "Songs" },
  { href: "/settings", label: "Settings" },
];

export function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }

  if (pathname === "/login" || pathname.startsWith("/watch")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#09090F" }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col py-7 px-4 flex-shrink-0"
        style={{ background: "#0D0D17", borderRight: "1px solid #1E1E2A" }}
      >
        {/* Wordmark */}
        <div className="mb-10 px-2">
          <div
            style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#C9A84C",
              letterSpacing: "-0.02em",
            }}
          >
            Versespan
          </div>
          <div className="mt-1.5">
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#C9A84C",
                background: "rgba(201,168,76,0.1)",
                padding: "2px 7px",
                borderRadius: "4px",
                border: "1px solid rgba(201,168,76,0.25)",
              }}
            >
              Alpha
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: isActive ? "#C9A84C" : "#6B6B7A",
                  background: isActive ? "rgba(201,168,76,0.08)" : "transparent",
                  borderLeft: isActive ? "2px solid #C9A84C" : "2px solid transparent",
                  fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <button
          onClick={handleLogout}
          className="px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
          style={{ color: "#3A3A4A", fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6B6B7A"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#3A3A4A"; }}
        >
          Sign out
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto" style={{ background: "#09090F" }}>
        {children}
      </main>
    </div>
  );
}
