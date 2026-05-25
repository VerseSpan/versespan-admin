"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }
  // Hide sidebar on /login and /watch (congregation view)
  if (pathname === "/login" || pathname.startsWith("/watch")) {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col py-6 px-4">
        <div className="mb-8">
          <span className="font-bold text-lg tracking-tight text-white">Versespan</span>
          <div className="mt-1">
            <span className="text-xs font-semibold tracking-widest uppercase px-2 py-0.5 rounded bg-amber-400 text-amber-900">
              Alpha
            </span>
          </div>
        </div>
        <nav className="flex flex-col gap-2">
          {[
            { href: "/", label: "Dashboard" },
            { href: "/sessions", label: "Sessions" },
            { href: "/songs", label: "Songs" },
            { href: "/settings", label: "Settings" },
          ].map(({ href, label }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded px-3 py-2 transition ${
                  isActive
                    ? "bg-gray-700 text-white font-semibold"
                    : "text-gray-200 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <button
          onClick={handleLogout}
          className="mt-4 text-left rounded px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-white transition text-sm"
        >
          Sign out
        </button>
      </aside>
      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
