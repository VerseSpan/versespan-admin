"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/sessions", label: "Sessions" },
  { href: "/songs", label: "Songs" },
  { href: "/settings", label: "Settings" },
  { href: "/admin/control", label: "Control" },
];

function Wordmark({ size = "1.5rem" }: { size?: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
        fontSize: size,
        fontWeight: 600,
        color: "#C9A84C",
        letterSpacing: "-0.02em",
      }}
    >
      Versespan
    </div>
  );
}

export function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }

  if (pathname === "/login" || pathname.startsWith("/watch") || pathname.startsWith("/join")) {
    return <>{children}</>;
  }

  const sidebarInner = (
    <>
      <div className="mb-10 px-2">
        <Wordmark />
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

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
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
        aria-label="Sign out"
        className="px-3 py-2.5 rounded-lg text-sm text-left transition-colors text-[#3A3A4A] hover:text-[#6B6B7A]"
        style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}
      >
        Sign out
      </button>
    </>
  );

  return (
    <div className="min-h-screen md:flex" style={{ background: "#09090F" }}>
      {/* Mobile top bar */}
      <header
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-30"
        style={{ background: "#0D0D17", borderBottom: "1px solid #1E1E2A" }}
      >
        <Wordmark size="1.25rem" />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -mr-2"
          style={{ color: "#C9A84C" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Desktop sidebar (static) */}
      <aside
        className="hidden md:flex w-56 flex-col py-7 px-4 flex-shrink-0"
        style={{ background: "#0D0D17", borderRight: "1px solid #1E1E2A" }}
      >
        {sidebarInner}
      </aside>

      {/* Mobile drawer + overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)} />
          <aside
            className="absolute left-0 top-0 h-full w-64 flex flex-col py-7 px-4"
            style={{ background: "#0D0D17", borderRight: "1px solid #1E1E2A" }}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 p-1"
              style={{ color: "#6B6B7A" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto" style={{ background: "#09090F" }}>
        {children}
      </main>
    </div>
  );
}
