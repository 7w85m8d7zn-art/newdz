import SafeLink from "next/link"

import { LogoutButton } from "@/components/auth/logout-button"
import { adminNavigation } from "@/data/admin-content"
import { cn } from "@/lib/utils"

interface AdminShellProps {
  children: React.ReactNode
  pathname: string
  title: string
  description: string
}

export function AdminShell({
  children,
  pathname,
  title,
  description,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[#fcfcfb] text-stone-950">
      <div className="grid min-h-screen lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden border-r border-stone-200 bg-white px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
      
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-[0.16em] text-stone-950">
                Dondurmacı Zeki
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Admin Kontrol
              </p>
            </div>
          </div>

          <nav className="mt-5 flex-1 space-y-2">
            {adminNavigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href))

              return (
                <SafeLink
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-[1rem] px-3 py-3 transition",
                    isActive
                      ? "bg-[#ef1c24] text-white shadow-[0_14px_30px_rgba(239,28,36,0.16)]"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                          isActive
                            ? "bg-white/10 text-white"
                            : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                </SafeLink>
              )
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-stone-200/80 bg-white/92 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2 lg:hidden">
                  <span className="rounded-full bg-[#ef1c24] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                    Admin Kontrol
                  </span>
                  <span className="text-sm text-stone-500">Dondurmacı Zeki</span>
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-stone-950 sm:text-2xl">
                    {title}
                  </h2>
                  <p className="mt-1 text-xs leading-6 text-stone-500 sm:text-sm">
                    {description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2.5 sm:justify-end sm:gap-3">
                  <LogoutButton className="hidden border-stone-200 bg-white text-stone-700 hover:bg-stone-50 lg:inline-flex" />
                </div>
              </div>
            </div>

            <div className="scrollbar-hide mt-4 flex gap-3 overflow-x-auto pb-1 lg:hidden">
              {adminNavigation.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href))

                return (
                <SafeLink
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "min-w-max rounded-full border px-3 py-1.5 text-xs font-medium transition sm:px-4 sm:py-2 sm:text-sm",
                    isActive
                      ? "border-[#ef1c24] bg-[#ef1c24] text-white"
                      : "border-stone-200 bg-white text-stone-600",
                  )}
                >
                  {item.label}
                </SafeLink>
                )
              })}
              <LogoutButton className="border-stone-200 bg-white text-stone-700 hover:bg-stone-50" />
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
