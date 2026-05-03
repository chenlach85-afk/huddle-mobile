import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Menu, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/teams", label: "Teams", icon: Users, exact: false },
];

function NavLinks({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact ? location === item.href : location.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} onClick={onClose}>
            <div
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer font-medium text-sm ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card shrink-0">
        <div className="p-5 border-b h-16 flex items-center">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer group">
              <div className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform shadow-sm">
                TH
              </div>
              <span className="font-bold tracking-tight text-lg">TeamHub</span>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks />
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Coach Mode</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-20 shadow-sm">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="bg-primary text-primary-foreground w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs">
                TH
              </div>
              <span className="font-bold tracking-tight">TeamHub</span>
            </div>
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 p-0">
              <div className="p-4 border-b h-14 flex items-center">
                <span className="font-bold tracking-tight">TeamHub</span>
              </div>
              <nav className="p-3 space-y-1">
                <NavLinks onClose={() => setMobileOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
