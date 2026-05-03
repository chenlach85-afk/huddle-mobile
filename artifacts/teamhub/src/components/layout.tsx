import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Menu, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Huddle", icon: LayoutDashboard, exact: true },
  { href: "/teams", label: "Squads", icon: Users, exact: false },
];

function NavLinks({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  return (
    <div className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact ? location === item.href : location.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} onClick={onClose}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer text-sm font-semibold ${
                isActive
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
              <span className="tracking-wide">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-white/6 shrink-0"
        style={{ background: "rgba(10,14,26,0.95)" }}>
        <div className="px-5 py-4 h-16 flex items-center border-b border-white/6">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
                <Zap className="h-5 w-5 text-white" fill="white" />
              </div>
              <div>
                <span className="font-display text-xl text-white tracking-wide">TEAMHUB</span>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 pt-4">
          <p className="section-label px-3 mb-3">Navigation</p>
          <NavLinks />
        </nav>

        <div className="p-4 border-t border-white/6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4">
            <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs font-bold">C</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70">Coach Mode</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden h-14 flex items-center justify-between px-4 sticky top-0 z-20 border-b border-white/6"
          style={{ background: "rgba(10,14,26,0.95)", backdropFilter: "blur(12px)" }}>
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
                <Zap className="h-4 w-4 text-white" fill="white" />
              </div>
              <span className="font-display text-lg text-white tracking-wide">TEAMHUB</span>
            </div>
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/8" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 p-0 border-white/8"
              style={{ background: "rgba(10,14,26,0.98)" }}>
              <div className="p-4 border-b border-white/6 h-14 flex items-center">
                <span className="font-display text-lg text-white tracking-wide">TEAMHUB</span>
              </div>
              <nav className="p-3 pt-4">
                <NavLinks onClose={() => setMobileOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
