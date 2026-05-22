import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ShieldOff, Mail, Lock } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/useAuth";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { UserSync } from "@/components/user-sync";
import Dashboard from "@/pages/dashboard";
import TeamsPage from "@/pages/teams";
import TeamDetailPage from "@/pages/team-detail";
import CalendarPage from "@/pages/calendar";
import MemberView from "@/pages/member-view";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import AuditLogPage from "@/pages/admin-audit-log";
import AdminInvitationsPage from "@/pages/admin-invitations";
import InvitePage from "@/pages/invite";
import TeamInvitePage from "@/pages/team-invite";
import LandingPage from "@/pages/landing";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import NotFound from "@/pages/not-found";
import { Link } from "wouter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthQueryInvalidator() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      qc.clear();
    }
    prevUserIdRef.current = userId;
  }, [user, qc]);

  return null;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect to="/dashboard" />;
  return <LandingPage />;
}

function NotActivatedScreen() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-white">{t.auth.accountNotActivated}</h1>
          <p className="text-sm text-white/50 leading-relaxed">{t.auth.accountNotActivatedDesc}</p>
        </div>
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 text-start"
          style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)" }}
        >
          <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">{t.auth.checkInviteEmail}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-sm text-primary hover:text-primary/80 underline underline-offset-4"
        >
          {t.common.signOut}
        </button>
      </div>
    </div>
  );
}

function ProtectedRouteInner({ children }: { children: React.ReactNode }) {
  const { appUser, isLoading, error } = useCurrentUser();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user && (error || !appUser)) {
    return <NotActivatedScreen />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/sign-in" />;
  }

  return (
    <>
      <UserSync />
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </>
  );
}

function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryInvalidator />
      <Switch>
        <Route path="/member/:joinCode" component={MemberView} />
        <Route path="/team-invite/:token" component={TeamInvitePage} />
        <Route path="/invite/:token" component={InvitePage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/" component={HomeRedirect} />
        <Route path="/dashboard">
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        </Route>
        <Route path="/teams/:teamId">
          <ProtectedRoute><TeamDetailPage /></ProtectedRoute>
        </Route>
        <Route path="/teams">
          <ProtectedRoute><TeamsPage /></ProtectedRoute>
        </Route>
        <Route path="/calendar">
          <ProtectedRoute><CalendarPage /></ProtectedRoute>
        </Route>
        <Route path="/settings">
          <ProtectedRoute><SettingsPage /></ProtectedRoute>
        </Route>
        <Route path="/admin/invitations">
          <ProtectedRoute><AdminInvitationsPage /></ProtectedRoute>
        </Route>
        <Route path="/admin/audit-log">
          <ProtectedRoute><AuditLogPage /></ProtectedRoute>
        </Route>
        <Route path="/admin">
          <ProtectedRoute><AdminPage /></ProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <I18nProvider>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={basePath}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </I18nProvider>
  );
}

export default App;
