import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Lock, ShieldOff, Mail } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { I18nProvider, useI18n } from "@/lib/i18n";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(22, 100%, 60%)",
    colorForeground: "hsl(210, 20%, 95%)",
    colorMutedForeground: "hsl(220, 15%, 55%)",
    colorDanger: "hsl(0, 84%, 55%)",
    colorBackground: "hsl(228, 38%, 11%)",
    colorInput: "hsl(228, 30%, 16%)",
    colorInputForeground: "hsl(210, 20%, 95%)",
    colorNeutral: "hsl(228, 28%, 28%)",
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-black/60",
    card: "!shadow-none !border-0 !rounded-none",
    footer: "!shadow-none !border-0 !rounded-none",
    headerTitle: "text-white font-semibold",
    headerSubtitle: "text-white/50",
    socialButtonsBlockButtonText: "text-white/80",
    formFieldLabel: "text-white/70 text-sm",
    footerActionLink: "text-orange-400 hover:text-orange-300",
    footerActionText: "text-white/40",
    dividerText: "text-white/30",
    identityPreviewEditButton: "text-orange-400",
    formFieldSuccessText: "text-green-400",
    alertText: "text-white/80",
    logoBox: "flex justify-center",
    logoImage: "h-9 w-auto",
    socialButtonsBlockButton: "border border-white/15 bg-white/5 hover:bg-white/10",
    formButtonPrimary: "bg-orange-500 hover:bg-orange-400 text-white font-semibold shadow-lg shadow-orange-500/25",
    formFieldInput: "bg-white/8 border-white/15 text-white placeholder:text-white/30",
    footerAction: "border-t border-white/8",
    dividerLine: "bg-white/10",
    alert: "border border-red-500/30 bg-red-500/10",
    otpCodeFieldInput: "border-white/20 bg-white/8 text-white",
    formFieldRow: "",
    main: "px-2",
  },
};

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(255,107,53,0.1) 0%, transparent 60%)" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} />
    </div>
  );
}

function SignUpPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(255,107,53,0.1) 0%, transparent 60%)" }}>
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.3)" }}>
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-white">{t.auth.invitationOnly}</h1>
          <p className="text-sm text-white/50 leading-relaxed">{t.auth.invitationOnlyDesc}</p>
        </div>
        <Link href="/sign-in">
          <button className="mt-2 text-sm text-primary hover:text-primary/80 underline underline-offset-4">
            {t.auth.backToSignIn}
          </button>
        </Link>
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><LandingPage /></Show>
    </>
  );
}

function NotActivatedScreen() {
  const { t } = useI18n();
  const { signOut } = useClerk();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-white">{t.auth.accountNotActivated}</h1>
          <p className="text-sm text-white/50 leading-relaxed">{t.auth.accountNotActivatedDesc}</p>
        </div>
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-start"
          style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)" }}>
          <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">{t.auth.checkInviteEmail}</p>
        </div>
        <button onClick={() => signOut()}
          className="text-sm text-primary hover:text-primary/80 underline underline-offset-4">
          {t.common.signOut}
        </button>
      </div>
    </div>
  );
}

function ProtectedRouteInner({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { appUser, isLoading, error } = useCurrentUser();

  // Show a blank loading screen while sync is in flight — prevents
  // briefly rendering content for users whose sync will return 403
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Sync completed but got a 403/404 — account not activated or not invited
  if (user && (error || !appUser)) {
    return <NotActivatedScreen />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <UserSync />
        <ProtectedRouteInner>{children}</ProtectedRouteInner>
      </Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function AppRouter() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
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
    </ClerkProvider>
  );
}

function App() {
  return (
    <I18nProvider>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </I18nProvider>
  );
}

export default App;
