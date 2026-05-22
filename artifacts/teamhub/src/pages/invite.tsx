import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, UserPlus, LogIn, ShieldCheck, AlertCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";

const DATE_LOCALES = { he, es, en: enUS };
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Invitation = {
  id: number;
  email: string;
  invitedRole: "coach" | "admin";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  inviterName: string | null;
  inviterEmail: string | null;
};

type ViewState =
  | "loading"
  | "invalid"
  | "not-signed-in"
  | "wrong-account"
  | "accepting"
  | "accepted"
  | "error"
  | "already-accepted";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { t, language } = useI18n();
  const inv = t.invitations;
  const { user, session, signOut } = useAuth();
  const isSignedIn = !!user;
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const dateLocale = DATE_LOCALES[language] ?? enUS;

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [view, setView] = useState<ViewState>("loading");

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/invitations/${token}`)
      .then((r) => r.json())
      .then((data: Invitation) => {
        setInvitation(data);
        if (data.status === "accepted") { setView("already-accepted"); return; }
        if (data.status !== "pending") { setView("invalid"); return; }
        resolveView(data, isSignedIn, user?.email);
      })
      .catch(() => setView("invalid"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!invitation || invitation.status !== "pending") return;
    resolveView(invitation, isSignedIn, user?.email);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user, invitation]);

  function resolveView(inv: Invitation, signedIn: boolean, currentEmail: string | undefined) {
    if (!signedIn) { setView("not-signed-in"); return; }
    const emailMatch = currentEmail && currentEmail.toLowerCase() === inv.email.toLowerCase();
    setView(emailMatch ? "not-signed-in" : "wrong-account");
  }

  async function handleAccept() {
    if (!token) return;
    if (!isSignedIn) { navigate(`/sign-in?redirect=/invite/${token}`); return; }
    setView("accepting");
    try {
      const res = await fetch(`${BASE}/api/invitations/${token}/accept`, {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error?.includes("already")) { setView("already-accepted"); return; }
        setView("error");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      setView("accepted");
    } catch {
      setView("error");
    }
  }

  const glassCard = "rounded-2xl p-8 space-y-6 max-w-md w-full mx-auto";
  const cardStyle = { background: "var(--surface-card)", border: "1px solid var(--border-subtle)" };

  if (view === "loading") {
    return (
      <PageShell>
        <div className={glassCard} style={cardStyle}>
          <div className="space-y-3 animate-pulse">
            <div className="h-12 w-12 rounded-xl bg-white/8 mx-auto" />
            <div className="h-6 bg-white/8 rounded-lg" />
            <div className="h-4 bg-white/5 rounded-lg w-3/4 mx-auto" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (view === "invalid") {
    return (
      <PageShell>
        <div className={glassCard} style={{ ...cardStyle, borderColor: "rgba(239,68,68,0.2)" }}>
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: "rgba(239,68,68,0.12)" }}>
              <AlertCircle className="h-7 w-7 text-red-400" />
            </div>
            <h1 className="font-display text-2xl text-white">{inv.invalidToken}</h1>
            <button onClick={() => navigate("/sign-in")} className="text-sm text-primary underline underline-offset-4">
              {t.auth.backToSignIn}
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (view === "already-accepted") {
    return (
      <PageShell>
        <div className={glassCard} style={cardStyle}>
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: "rgba(46,204,113,0.12)" }}>
              <CheckCircle2 className="h-7 w-7 text-green-400" />
            </div>
            <h1 className="font-display text-2xl text-white">{inv.alreadyAccepted}</h1>
            <button onClick={() => navigate("/dashboard")} className="text-sm text-primary underline underline-offset-4">
              {t.nav.huddle}
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (view === "accepted") {
    return (
      <PageShell>
        <div className={glassCard} style={{ ...cardStyle, borderColor: "rgba(255,107,53,0.2)" }}>
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: "rgba(255,107,53,0.15)" }}>
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl text-white">{inv.acceptSuccess}</h1>
            <Button onClick={() => navigate("/dashboard")} className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-11">
              Go to Dashboard →
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (view === "error") {
    return (
      <PageShell>
        <div className={glassCard} style={{ ...cardStyle, borderColor: "rgba(239,68,68,0.2)" }}>
          <div className="text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
            <h1 className="font-display text-2xl text-white">Something went wrong</h1>
            <button onClick={() => setView("not-signed-in")} className="text-sm text-primary underline underline-offset-4">
              Try again
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (view === "wrong-account" && invitation) {
    const currentEmail = user?.email ?? "";
    return (
      <PageShell>
        <div className={glassCard} style={{ ...cardStyle, borderColor: "rgba(247,181,56,0.25)" }}>
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: "rgba(247,181,56,0.12)" }}>
              <AlertCircle className="h-7 w-7 text-yellow-400" />
            </div>
            <h1 className="font-display text-2xl text-white">{inv.wrongAccount}</h1>
          </div>
          <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: "rgba(247,181,56,0.06)", border: "1px solid rgba(247,181,56,0.18)" }}>
            <div className="flex justify-between">
              <span className="text-white/40">{inv.inviteRole}</span>
              <span className="text-yellow-300 font-medium">{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Signed in as</span>
              <span className="text-white/70">{currentEmail}</span>
            </div>
          </div>
          <p className="text-sm text-white/50 text-center leading-relaxed">{inv.wrongAccountDesc}</p>
          <div className="space-y-2">
            <Button
              onClick={() => signOut()}
              className="w-full bg-yellow-500/90 hover:bg-yellow-500 text-black font-bold rounded-xl h-11 gap-2"
            >
              <LogOut className="h-4 w-4" />
              {inv.signOutToContinue}
            </Button>
            <button onClick={() => navigate("/dashboard")} className="w-full text-xs text-white/30 hover:text-white/50 transition-colors py-1">
              {t.common.cancel}
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!invitation) return null;

  const roleLabel = invitation.invitedRole === "admin" ? inv.roleAdmin : inv.roleCoach;
  const expiresText = formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true, locale: dateLocale });

  return (
    <PageShell>
      <div className={glassCard} style={cardStyle}>
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.25)" }}>
            {invitation.invitedRole === "admin" ? (
              <ShieldCheck className="h-7 w-7 text-primary" />
            ) : (
              <UserPlus className="h-7 w-7 text-primary" />
            )}
          </div>
          <h1 className="font-display text-3xl text-white">{inv.inviteTitle}</h1>
        </div>

        <div className="space-y-2 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {invitation.inviterName && (
            <div className="flex justify-between text-sm">
              <span className="text-white/40">{inv.invitedBy}</span>
              <span className="text-white font-medium">{invitation.inviterName}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{inv.inviteRole}</span>
            <span className="font-bold text-xs px-2 py-0.5 rounded-md" style={{ background: "rgba(255,107,53,0.15)", color: "#FF6B35" }}>
              {roleLabel}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/40">{inv.inviteExpires}</span>
            <span className="text-white/60 text-xs">{expiresText}</span>
          </div>
        </div>

        {isSignedIn ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-white/50 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <span className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {user.email?.charAt(0).toUpperCase() ?? "U"}
              </span>
              <span className="truncate">{user.email}</span>
            </div>
            <Button
              onClick={handleAccept}
              disabled={view === "accepting"}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-11"
            >
              {view === "accepting" ? inv.accepting : inv.acceptInvite}
            </Button>
            <button onClick={() => signOut()} className="w-full text-xs text-white/30 hover:text-white/50 transition-colors">
              {t.common.signOut}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/50 text-center">{inv.signInToAccept}</p>
            <Button
              onClick={() => navigate(`/sign-in?redirect=/invite/${token}`)}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-11 gap-2"
            >
              <LogIn className="h-4 w-4" />
              Sign In to Accept
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(255,107,53,0.1) 0%, transparent 60%)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="font-display text-2xl text-primary tracking-wide">CLASIKO</span>
        </div>
        {children}
      </div>
    </div>
  );
}
