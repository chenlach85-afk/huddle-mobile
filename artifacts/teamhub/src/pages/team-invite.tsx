import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, MapPin, CheckCircle, AlertCircle, Clock, Lock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type InviteData = {
  id: number;
  inviteType: string;
  email: string | null;
  status: string;
  expiresAt: string;
  teamId: number;
  teamName: string | null;
  teamSport: string | null;
  teamColor: string | null;
  teamJoinCode: string | null;
  coachName: string | null;
  inviterName: string | null;
};

function TeamInviteContent({ token }: { token: string }) {
  const { user, session } = useAuth();
  const isSignedIn = !!user;
  const [, setLocation] = useLocation();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const { data: invite, isLoading, error } = useQuery<InviteData>({
    queryKey: ["team-invite", token],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/team-invite/${token}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    retry: false,
  });

  async function handleAccept() {
    if (!isSignedIn) {
      setLocation(`/sign-in?redirect=/team-invite/${token}`);
      return;
    }
    setAccepting(true);
    setAcceptError(null);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${BASE}/api/team-invite/${token}/accept`, {
        method: "POST",
        headers,
      });
      const body = await res.json();
      if (!res.ok) {
        const msg = body.error === "invitation_revoked" ? "This invitation has been revoked."
          : body.error === "invitation_expired" ? "This invitation has expired."
          : body.error === "invitation_already_accepted" ? "This invitation has already been accepted."
          : "Failed to accept invitation.";
        setAcceptError(msg);
      } else {
        setAccepted(true);
        if (body.joinCode) {
          setTimeout(() => setLocation(`/member/${body.joinCode}`), 2000);
        }
      }
    } catch {
      setAcceptError("Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-3/4 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} />
        <Skeleton className="h-6 w-1/2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        <Skeleton className="h-10 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="font-display text-2xl text-white">Invitation Not Found</h1>
        <p className="text-sm text-white/50">This invitation link is invalid or has expired.</p>
      </div>
    );
  }

  const isExpired = invite.status === "expired" || (invite.expiresAt && new Date() > new Date(invite.expiresAt));
  const isRevoked = invite.status === "revoked";
  const isAlreadyAccepted = invite.status === "accepted";
  const teamColor = invite.teamColor ?? "#FF6B35";
  const expiresDate = invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : null;

  if (accepted) {
    return (
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(46,204,113,0.15)", border: "1px solid rgba(46,204,113,0.3)" }}>
          <CheckCircle className="h-10 w-10 text-green-400" />
        </div>
        <h1 className="font-display text-3xl text-white">You've Joined!</h1>
        <p className="text-sm text-white/60">
          Welcome to <strong className="text-white">{invite.teamName}</strong>!
          Redirecting you to the team...
        </p>
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
      </div>
    );
  }

  if (isRevoked) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="font-display text-2xl text-white">Invitation Revoked</h1>
        <p className="text-sm text-white/50">This invitation has been cancelled by the coach.</p>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(247,181,56,0.12)", border: "1px solid rgba(247,181,56,0.25)" }}>
          <Clock className="h-8 w-8 text-yellow-400" />
        </div>
        <h1 className="font-display text-2xl text-white">Invitation Expired</h1>
        <p className="text-sm text-white/50">This invitation has expired. Ask your coach to send a new one.</p>
      </div>
    );
  }

  if (isAlreadyAccepted) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: "rgba(46,204,113,0.12)", border: "1px solid rgba(46,204,113,0.25)" }}>
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="font-display text-2xl text-white">Already Accepted</h1>
        <p className="text-sm text-white/50">This invitation has already been accepted.</p>
        {invite.teamJoinCode && (
          <Button onClick={() => setLocation(`/member/${invite.teamJoinCode}`)}
            className="font-semibold rounded-xl" style={{ background: teamColor, color: "white" }}>
            View Team
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center font-display text-4xl text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}88)` }}>
          {(invite.teamName ?? "T").charAt(0).toUpperCase()}
        </div>
        <h1 className="font-display text-3xl text-white tracking-wide">
          {invite.teamName ?? "Team Invitation"}
        </h1>
        {invite.teamSport && (
          <p className="text-sm text-white/50 mt-1 uppercase tracking-widest font-semibold">
            {invite.teamSport}
          </p>
        )}
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-card)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {invite.inviterName && (
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-white/70">
              Invited by <span className="text-white font-semibold">{invite.inviterName}</span>
            </p>
          </div>
        )}
        {invite.coachName && (
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-white/30 shrink-0" />
            <p className="text-sm text-white/50">Coach: {invite.coachName}</p>
          </div>
        )}
        {expiresDate && (
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-white/30 shrink-0" />
            <p className="text-sm text-white/50">Expires {expiresDate}</p>
          </div>
        )}
      </div>

      {!isSignedIn && (
        <div className="rounded-xl p-3 flex items-start gap-3"
          style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)" }}>
          <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">
            You need to sign in to accept this invitation. You'll be redirected back after signing in.
          </p>
        </div>
      )}

      {acceptError && (
        <p className="text-sm text-red-400 text-center">{acceptError}</p>
      )}

      <Button
        onClick={handleAccept}
        disabled={accepting}
        className="w-full h-12 font-bold text-base rounded-xl shadow-lg"
        style={{ background: teamColor, color: "white" }}>
        {accepting ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Accepting...
          </span>
        ) : isSignedIn ? "Accept & Join Team" : "Sign In to Accept"}
      </Button>

      <p className="text-center text-xs text-white/25">
        By accepting, you'll be added as a player to this team.
      </p>
    </div>
  );
}

export default function TeamInvitePage() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,107,53,0.12) 0%, transparent 60%)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="font-display text-2xl text-primary tracking-wide">HUDDLE</span>
        </div>
        <div className="rounded-2xl p-8" style={{ background: "var(--surface-elevated)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {token ? <TeamInviteContent token={token} /> : (
            <p className="text-center text-white/50 text-sm">Invalid invitation link.</p>
          )}
        </div>
      </div>
    </div>
  );
}
