import { useAuth } from "@/lib/useAuth";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { Settings, LogOut, ChevronDown, ShieldCheck, Users } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { appUser } = useCurrentUser();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName = appUser?.name ?? user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "—";
  const displayEmail = appUser?.email ?? user?.email ?? "—";
  const initials = displayName !== "—" ? displayName.charAt(0).toUpperCase() : "?";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors hover:bg-accent"
        data-testid="button-user-menu"
      >
        <div className="w-7 h-7 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{initials}</span>
        </div>
        <span className="text-sm font-medium text-foreground/80 hidden lg:block max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute end-0 top-full mt-1 w-56 rounded-2xl shadow-xl z-50 py-1"
          style={{ background: "var(--surface-overlay)", border: "1px solid var(--border-subtle)" }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-foreground/50 truncate">{displayEmail}</p>
            {appUser?.role && (
              <span
                className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{
                  background: appUser.role === "admin" ? "rgba(255,107,53,0.15)" : "rgba(74,144,226,0.12)",
                  color: appUser.role === "admin" ? "#FF6B35" : "#4a90e2",
                }}
              >
                {appUser.role === "admin" ? (
                  <ShieldCheck className="h-2.5 w-2.5" />
                ) : (
                  <Users className="h-2.5 w-2.5" />
                )}
                {appUser.role === "admin" ? "Admin" : appUser.role === "coach" ? "Coach" : "Player"}
              </span>
            )}
          </div>

          <div className="py-1">
            <Link href="/settings" onClick={() => setOpen(false)}>
              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground/70 hover:text-foreground hover:bg-accent transition-colors text-start">
                <Settings className="h-3.5 w-3.5 shrink-0" />
                {t.nav.settings}
              </button>
            </Link>
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-colors text-start"
              data-testid="button-sign-out"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {t.common.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
