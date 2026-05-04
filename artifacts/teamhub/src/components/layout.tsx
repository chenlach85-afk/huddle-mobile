import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Calendar, Menu, Zap, Settings, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/useCurrentUser";

function NavItems({ onClose }: { onClose?: () => void }) {
  const { t } = useI18n();
  const [location] = useLocation();
  const { appUser } = useCurrentUser();

  const NAV_ITEMS = [
    { href: "/dashboard", label: t.nav.huddle, icon: LayoutDashboard, exact: true },
    { href: "/teams", label: t.nav.squads, icon: Users, exact: false },
    { href: "/calendar", label: t.nav.calendar, icon: Calendar, exact: false },
    { href: "/settings", label: t.nav.settings, icon: Settings, exact: false },
    ...(appUser?.role === "admin"
      ? [{ href: "/admin", label: t.nav.admin, icon: ShieldCheck, exact: false }]
      : []),
  ];

  return (
    <div className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact ? location === item.href : location.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} onClick={onClose}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm font-semibold",
                isActive
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5",
              )}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className={cn("h-4 w-4", isActive && "text-primary")} />
              <span>{item.label}</span>
              {isActive && <div className="ms-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t, isRTL } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn("min-h-screen bg-background flex", isRTL && "flex-row-reverse")} dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-60 flex-col shrink-0"
        style={{
          background: "rgba(10,14,26,0.95)",
          borderRight: isRTL ? "none" : "1px solid rgba(255,255,255,0.06)",
          borderLeft: isRTL ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <div className="px-5 py-4 h-16 flex items-center border-b border-white/6">
          <Link href="/dashboard">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
                <Zap className="h-5 w-5 text-white" fill="white" />
              </div>
              <span className="font-wordmark text-xl text-white">TEAMHUB</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 pt-4">
          <p className="section-label px-3 mb-3">{t.common.coachMode}</p>
          <NavItems />
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header
          className="md:hidden h-14 flex items-center justify-between px-4 sticky top-0 z-20 border-b border-white/6"
          style={{ background: "rgba(10,14,26,0.95)", backdropFilter: "blur(12px)" }}
        >
          <Link href="/dashboard">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
                <Zap className="h-4 w-4 text-white" fill="white" />
              </div>
              <span className="font-wordmark text-lg text-white">TEAMHUB</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/8" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={isRTL ? "right" : "left"} className="w-56 p-0 border-white/8"
                style={{ background: "rgba(10,14,26,0.98)" }}>
                <div className="p-4 border-b border-white/6 h-14 flex items-center">
                  <span className="font-wordmark text-lg text-white">TEAMHUB</span>
                </div>
                <nav className="p-3 pt-4">
                  <NavItems onClose={() => setMobileOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Desktop top-right notification bar */}
        <div className="hidden md:flex h-12 items-center justify-end px-5 border-b border-white/4"
          style={{ background: "rgba(10,14,26,0.6)" }}>
          <NotificationBell />
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
