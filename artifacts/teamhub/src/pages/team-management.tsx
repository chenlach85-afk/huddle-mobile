import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  UserCog, Plus, Trash2, ArrowRightLeft, Archive, ArchiveRestore,
  Copy, Check, AlertTriangle, Mail, Link2, Crown, Shield, User,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@clerk/react";

type CoachMember = {
  userId: number;
  clerkId: string;
  name: string;
  email: string;
  role: "coach" | "player" | "assistant";
  isOwner: boolean;
  coachTitle?: string | null;
};

type PendingInvite = {
  id: number;
  email: string | null;
  inviteType: string;
  status: string;
  url: string;
  createdAt: string;
  expiresAt: string;
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  coach: Crown,
  assistant: Shield,
  player: User,
};

export default function TeamManagementTab({
  teamId,
  teamColor,
  teamName,
  joinCode,
  isOwner,
}: {
  teamId: number;
  teamColor: string;
  teamName: string;
  joinCode?: string;
  isOwner: boolean;
}) {
  const { t } = useI18n();
  const mg = t.management;
  const ti = t.teamInvite;
  const { toast } = useToast();
  const { user: clerkUser } = useUser();

  const [coaches, setCoaches] = useState<CoachMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [coachEmail, setCoachEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sending" | "generating" | "sent" | "error">("idle");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>("");
  const [transferLoading, setTransferLoading] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [copiedJoinCode, setCopiedJoinCode] = useState(false);

  const [titleEditUserId, setTitleEditUserId] = useState<number | null>(null);
  const [titleInput, setTitleInput] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const coachRes = await fetch(`/api/teams/${teamId}/coaches`);
      if (coachRes.ok) {
        const data = await coachRes.json();
        setCoaches(Array.isArray(data) ? data : (data.coaches ?? []));
        const invites: PendingInvite[] = Array.isArray(data) ? [] : (data.pendingInvites ?? []);
        setPendingInvites(invites.filter((i: PendingInvite) => i.status === "pending" && i.inviteType === "email"));
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function updateTitle(userId: number) {
    const res = await fetch(`/api/teams/${teamId}/coaches/${userId}/title`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleInput.trim() || null }),
    });
    if (res.ok) {
      toast({ title: mg.titleUpdated });
      setTitleEditUserId(null);
      loadData();
    } else toast({ title: mg.failedAction, variant: "destructive" });
  }

  async function changeRole(userId: number, role: string) {
    const res = await fetch(`/api/teams/${teamId}/coaches/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) { toast({ title: mg.staffUpdated }); loadData(); }
    else toast({ title: mg.failedAction, variant: "destructive" });
  }

  async function removeCoach(userId: number) {
    if (!confirm(mg.confirmRemoveCoach)) return;
    const res = await fetch(`/api/teams/${teamId}/coaches/${userId}`, { method: "DELETE" });
    if (res.ok) { toast({ title: mg.staffUpdated }); loadData(); }
    else toast({ title: mg.failedAction, variant: "destructive" });
  }

  async function sendCoachInvite() {
    if (!coachEmail.includes("@")) return;
    setInviteStatus("sending");
    const res = await fetch(`/api/teams/${teamId}/coaches/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: coachEmail, invitedRole: "coach" }),
    });
    if (res.ok) {
      setInviteStatus("sent");
      toast({ title: ti.inviteSent });
      setCoachEmail("");
      loadData();
    } else {
      setInviteStatus("error");
    }
  }

  async function generateCoachLink() {
    setInviteStatus("generating");
    const res = await fetch(`/api/teams/${teamId}/coaches/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "link", invitedRole: "coach" }),
    });
    if (res.ok) {
      const data = await res.json();
      setGeneratedLink(data.url);
      setInviteStatus("idle");
      loadData();
    } else {
      setInviteStatus("error");
    }
  }

  async function copyGeneratedLink() {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink).catch(() => {});
    setCopiedLink(true);
    toast({ title: ti.linkCopied });
    setTimeout(() => setCopiedLink(false), 2000);
  }

  async function transferOwnership() {
    if (!transferTargetId) return;
    setTransferLoading(true);
    const res = await fetch(`/api/teams/${teamId}/transfer-ownership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerId: parseInt(transferTargetId), confirm: true }),
    });
    if (res.ok) {
      toast({ title: mg.ownershipTransferred });
      setTransferOpen(false);
      loadData();
    } else {
      toast({ title: mg.failedAction, variant: "destructive" });
    }
    setTransferLoading(false);
  }

  async function archiveTeam() {
    setArchiveLoading(true);
    const res = await fetch(`/api/teams/${teamId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: archiveReason || null }),
    });
    if (res.ok) {
      toast({ title: mg.teamArchived });
      setArchiveOpen(false);
    } else {
      toast({ title: mg.failedAction, variant: "destructive" });
    }
    setArchiveLoading(false);
  }

  async function deleteTeam() {
    if (deletePhrase !== "DELETE PERMANENTLY") return;
    setDeleteLoading(true);
    const res = await fetch(`/api/teams/${teamId}/destroy`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmPhrase: "DELETE PERMANENTLY" }),
    });
    if (res.ok) {
      toast({ title: mg.teamDeleted });
      window.location.href = "/teams";
    } else {
      toast({ title: mg.failedAction, variant: "destructive" });
    }
    setDeleteLoading(false);
  }

  async function copyJoinCode() {
    if (!joinCode) return;
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
    await navigator.clipboard.writeText(`${base}/member/${joinCode}`).catch(() => {});
    setCopiedJoinCode(true);
    setTimeout(() => setCopiedJoinCode(false), 2000);
    toast({ title: ti.linkCopied });
  }

  const roleLabel = (role: string) => {
    if (role === "coach") return mg.roleCoach;
    if (role === "assistant") return mg.roleAssistant;
    return mg.rolePlayer;
  };

  const roleIcon = (role: string, isOwner: boolean) => {
    if (isOwner) return Crown;
    return ROLE_ICONS[role] ?? User;
  };

  const otherCoaches = coaches.filter(c => !c.isOwner && clerkUser?.id !== c.clerkId);

  return (
    <div className="space-y-6">

      {/* Coaching Staff */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
        <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4" style={{ color: teamColor }} />
            <p className="font-semibold text-white text-sm">{mg.coachingStaff}</p>
          </div>
          {isOwner && (
            <Button size="sm" variant="ghost"
              onClick={() => { setInviteOpen(true); setInviteStatus("idle"); setGeneratedLink(null); setCoachEmail(""); }}
              className="text-xs text-white/50 hover:text-white border border-white/10 rounded-xl">
              <Plus className="h-3 w-3 me-1" />
              {mg.inviteCoach}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1,2].map(i => <Skeleton key={i} className="h-12 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
          </div>
        ) : coaches.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-white/30">{mg.noCoaches}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {coaches.map(coach => {
              const RoleIcon = roleIcon(coach.role, coach.isOwner);
              const isMe = clerkUser?.id === coach.clerkId;
              return (
                <div key={coach.userId} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{ background: `${teamColor}25`, color: teamColor }}>
                    {coach.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{coach.name}</p>
                      {isMe && <span className="text-[10px] text-white/30">(you)</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <RoleIcon className="h-3 w-3 shrink-0" style={{ color: coach.isOwner ? "#f7b538" : "rgba(255,255,255,0.35)" }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: coach.isOwner ? "#f7b538" : "rgba(255,255,255,0.35)" }}>
                        {coach.isOwner ? mg.youOwner : roleLabel(coach.role)}
                      </span>
                      {coach.coachTitle && (
                        <span className="text-[10px] text-white/40 font-medium px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(255,255,255,0.06)" }}>
                          {coach.coachTitle}
                        </span>
                      )}
                      {isOwner && !coach.isOwner && (
                        <button
                          onClick={() => { setTitleEditUserId(coach.userId); setTitleInput(coach.coachTitle ?? ""); }}
                          className="text-[9px] text-white/20 hover:text-white/50 transition-colors">
                          {mg.editTitle}
                        </button>
                      )}
                    </div>
                    {/* Inline title editor */}
                    {titleEditUserId === coach.userId && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex gap-1.5 flex-wrap">
                          {(mg.coachTitleChips as string[]).map(chip => (
                            <button key={chip} onClick={() => setTitleInput(chip)}
                              className="px-2 py-0.5 rounded text-[9px] font-semibold transition-all border"
                              style={titleInput === chip
                                ? { background: `${teamColor}25`, color: teamColor, borderColor: `${teamColor}50` }
                                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }
                              }>
                              {chip}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <input
                            value={titleInput}
                            onChange={e => setTitleInput(e.target.value)}
                            placeholder={mg.coachTitlePlaceholder}
                            className="flex-1 h-7 rounded-lg px-2 text-xs bg-white/6 border border-white/10 text-white placeholder:text-white/20 outline-none"
                          />
                          <button onClick={() => updateTitle(coach.userId)}
                            className="h-7 px-2 rounded-lg text-xs font-semibold text-white"
                            style={{ background: teamColor }}>
                            {t.common.save}
                          </button>
                          <button onClick={() => setTitleEditUserId(null)}
                            className="h-7 px-2 rounded-lg text-xs text-white/40 border border-white/10">
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {isOwner && !coach.isOwner && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Select value={coach.role} onValueChange={v => changeRole(coach.userId, v)}>
                        <SelectTrigger className="h-7 text-xs bg-white/4 border-white/10 text-white/60 rounded-lg w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                          <SelectItem value="coach" className="text-white text-xs">{mg.roleCoach}</SelectItem>
                          <SelectItem value="assistant" className="text-white text-xs">{mg.roleAssistant}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/50 hover:text-red-400"
                        onClick={() => removeCoach(coach.userId)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending coach invitations */}
      {pendingInvites.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
          <div className="px-4 py-3 border-b border-white/6">
            <p className="font-semibold text-white/50 text-xs uppercase tracking-wider">{mg.pendingCoachInvites}</p>
          </div>
          <div className="divide-y divide-white/5">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="px-4 py-3 flex items-center gap-3">
                <Mail className="h-3.5 w-3.5 text-white/30 shrink-0" />
                <p className="text-sm text-white/60 flex-1 truncate">{inv.email}</p>
                <span className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wider">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Squad Settings */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
        <div className="px-4 py-3 border-b border-white/6">
          <p className="font-semibold text-white/50 text-xs uppercase tracking-wider">{mg.squadSettings}</p>
        </div>
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="stat-label text-white/40 mb-1.5">{mg.joinCode}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-sm font-mono text-white/70">
                {joinCode ?? "—"}
              </code>
              <Button size="sm" variant="ghost"
                onClick={copyJoinCode}
                className="border border-white/10 rounded-xl text-white/50 hover:text-white">
                {copiedJoinCode ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone — owner only */}
      {isOwner && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(231,76,60,0.3)", background: "rgba(231,76,60,0.05)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(231,76,60,0.2)" }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <p className="font-semibold text-red-400 text-sm uppercase tracking-wider">{mg.dangerZone}</p>
            </div>
          </div>
          <div className="px-4 py-4 space-y-3">
            {/* Transfer ownership */}
            {otherCoaches.length > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/80">{mg.transferOwnership}</p>
                  <p className="text-xs text-white/40 mt-0.5">{mg.confirmTransfer}</p>
                </div>
                <Button size="sm" variant="ghost"
                  onClick={() => setTransferOpen(true)}
                  className="border border-white/15 text-white/60 hover:text-white rounded-xl shrink-0">
                  <ArrowRightLeft className="h-3.5 w-3.5 me-1.5" />
                  {mg.transferOwnership}
                </Button>
              </div>
            )}

            {/* Archive */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white/80">{mg.archiveTeam}</p>
                <p className="text-xs text-white/40 mt-0.5">{mg.confirmArchive}</p>
              </div>
              <Button size="sm" variant="ghost"
                onClick={() => setArchiveOpen(true)}
                className="border border-amber-500/30 text-amber-400/70 hover:text-amber-400 rounded-xl shrink-0">
                <Archive className="h-3.5 w-3.5 me-1.5" />
                {mg.archiveTeam}
              </Button>
            </div>

            {/* Delete */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-400/80">{mg.deleteTeam}</p>
                <p className="text-xs text-white/30 mt-0.5">Permanently destroy all team data</p>
              </div>
              <Button size="sm" variant="ghost"
                onClick={() => setDeleteOpen(true)}
                className="border border-red-500/30 text-red-400/70 hover:text-red-400 rounded-xl shrink-0">
                <Trash2 className="h-3.5 w-3.5 me-1.5" />
                {mg.deleteTeam}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Coach Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">
              {mg.inviteCoach.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {inviteStatus === "sent" ? (
              <div className="rounded-xl p-4 text-center space-y-1.5"
                style={{ background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)" }}>
                <Check className="h-6 w-6 text-green-400 mx-auto" />
                <p className="text-sm font-semibold text-green-400">{ti.inviteSent}</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="stat-label text-white/50 block mb-1.5">{mg.coachEmail}</label>
                  <Input
                    type="email"
                    value={coachEmail}
                    onChange={e => { setCoachEmail(e.target.value); setInviteStatus("idle"); }}
                    placeholder={mg.coachEmailPlaceholder}
                    className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                  />
                </div>
                {generatedLink && (
                  <div className="rounded-xl p-3 flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-xs text-white/60 font-mono flex-1 truncate">{generatedLink}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyGeneratedLink}>
                      {copiedLink ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/50" />}
                    </Button>
                  </div>
                )}
                {inviteStatus === "error" && (
                  <p className="text-xs text-red-400">{ti.inviteError}</p>
                )}
                <div className="space-y-2">
                  <Button
                    onClick={sendCoachInvite}
                    disabled={inviteStatus === "sending" || !coachEmail.includes("@")}
                    className="w-full font-semibold rounded-xl h-10"
                    style={{ background: teamColor, color: "white" }}>
                    {inviteStatus === "sending" ? ti.sending : mg.sendCoachInvite}
                  </Button>
                  <Button
                    onClick={generateCoachLink}
                    disabled={inviteStatus === "generating"}
                    variant="ghost"
                    className="w-full font-semibold rounded-xl h-10 border border-white/10 text-white/60">
                    <Link2 className="h-3.5 w-3.5 me-2" />
                    {inviteStatus === "generating" ? ti.sending : ti.generateLink}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">
              {mg.transferOwnership.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-white/50">{mg.confirmTransfer}</p>
            <Select value={transferTargetId} onValueChange={setTransferTargetId}>
              <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                <SelectValue placeholder="Select a coach" />
              </SelectTrigger>
              <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                {otherCoaches.map(c => (
                  <SelectItem key={c.userId} value={String(c.userId)} className="text-white">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={transferOwnership}
              disabled={transferLoading || !transferTargetId}
              className="w-full font-semibold rounded-xl h-10 bg-amber-500/80 hover:bg-amber-500 text-white">
              <ArrowRightLeft className="h-3.5 w-3.5 me-2" />
              {transferLoading ? t.common.saving : mg.transferOwnership}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">
              {mg.archiveTeam.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-white/50">{mg.confirmArchive}</p>
            <div>
              <label className="stat-label text-white/40 block mb-1.5">{mg.archiveReason}</label>
              <Input
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder={mg.archiveReasonPlaceholder}
                className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
              />
            </div>
            <Button
              onClick={archiveTeam}
              disabled={archiveLoading}
              className="w-full font-semibold rounded-xl h-10 bg-amber-500/80 hover:bg-amber-500 text-white">
              <Archive className="h-3.5 w-3.5 me-2" />
              {archiveLoading ? t.common.saving : mg.archiveTeam}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-red-400 tracking-wide">
              {mg.deleteTeam.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl p-3" style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.2)" }}>
              <p className="text-xs text-red-300/80">This will permanently delete <strong>{teamName}</strong> and all its players, events, tasks, and messages. This cannot be undone.</p>
            </div>
            <div>
              <label className="stat-label text-white/40 block mb-1.5">{mg.deleteConfirmPhrase}</label>
              <Input
                value={deletePhrase}
                onChange={e => setDeletePhrase(e.target.value)}
                placeholder={mg.deletePhrasePlaceholder}
                className="bg-white/6 border-red-400/20 text-white placeholder:text-white/30 rounded-xl"
              />
            </div>
            <Button
              onClick={deleteTeam}
              disabled={deleteLoading || deletePhrase !== "DELETE PERMANENTLY"}
              className="w-full font-semibold rounded-xl h-10 bg-red-600 hover:bg-red-500 text-white disabled:opacity-30">
              <Trash2 className="h-3.5 w-3.5 me-2" />
              {deleteLoading ? t.common.saving : mg.deleteTeam}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
