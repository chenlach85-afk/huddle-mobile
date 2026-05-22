import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  UserCog, Plus, Trash2, ArrowRightLeft, Archive, ArchiveRestore,
  Copy, Check, AlertTriangle, Mail, Link2, Crown, Shield, User,
  MoreVertical, MessageCircle, Pencil, ToggleLeft, ToggleRight,
  Send, Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { formatDistanceToNow } from "date-fns";

type StaffMember = {
  id: number;
  userId: number | null;
  clerkId?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: "coach" | "assistant" | "player";
  isOwner: boolean;
  isPlaceholder: boolean;
  coachTitle?: string | null;
  memberNotes?: string | null;
  status: string;
  canManageTeamSettings: boolean;
  invitationId?: number | null;
  inviteToken?: string | null;
  inviteUrl?: string | null;
  emailSendCount?: number;
  inviteExpiresAt?: string | null;
  inviteStatus?: string | null;
  createdAt: string;
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  coach: Crown, assistant: Shield, player: User,
};

const TITLE_QUICK_PICKS = [
  "Head Coach", "Associate Head Coach", "GK Coach", "Fitness Coach",
  "Position Coach", "S&C Coach", "Analyst", "Assistant",
];

function StatusBadge({ status, emailSendCount, createdAt }: { status: string; emailSendCount?: number; createdAt?: string }) {
  if (status === "active") return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#2ecc7115", color: "#2ecc71" }}>Active</span>
  );
  if (status === "invited") return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#3498db15", color: "#3498db" }}>
      Invited · {emailSendCount ?? 0} of 5 sends
    </span>
  );
  if (status === "pending_invitation") return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#f7b53815", color: "#f7b538" }}>Pending · not sent</span>
  );
  if (status === "declined") return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "#e74c3c15", color: "#e74c3c" }}>Declined</span>
  );
  return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}>{status}</span>;
}

function AddManagerDialog({ open, onClose, teamId, teamColor, initialData, onSaved }: {
  open: boolean; onClose: () => void; teamId: number; teamColor: string;
  initialData?: StaffMember | null; onSaved: () => void;
}) {
  const { t } = useI18n();
  const mg = t.management;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isEdit = !!initialData;

  const [firstName, setFirstName] = useState(() => {
    if (!initialData) return "";
    const parts = initialData.name.split(" ");
    return parts[0] ?? "";
  });
  const [familyName, setFamilyName] = useState(() => {
    if (!initialData) return "";
    const parts = initialData.name.split(" ");
    return parts.slice(1).join(" ");
  });
  const [coachTitle, setCoachTitle] = useState(initialData?.coachTitle ?? "");
  const [notes, setNotes] = useState(initialData?.memberNotes ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [role, setRole] = useState<"coach" | "assistant">(
    (initialData?.role === "assistant" ? "assistant" : "coach") as "coach" | "assistant"
  );
  const [canManage, setCanManage] = useState(initialData?.canManageTeamSettings ?? false);
  const [inviteAction, setInviteAction] = useState<"none" | "send_email" | "generate_link">("none");
  const [personalMessage, setPersonalMessage] = useState("");

  useEffect(() => {
    if (role === "assistant") setCanManage(false);
  }, [role]);

  async function handleSave() {
    if (!firstName.trim() || !familyName.trim()) {
      toast({ title: "First name and family name required", variant: "destructive" }); return;
    }
    if (inviteAction !== "none" && !email.includes("@") && !phone.trim()) {
      toast({ title: "Email or phone required to send invitation", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const body = {
        first_name: firstName.trim(), family_name: familyName.trim(),
        coach_title: coachTitle.trim() || null, notes: notes.trim() || null,
        email: email.trim() || null, phone: phone.trim() || null,
        role, can_manage_team_settings: canManage,
        ...(isEdit ? {} : { invitation_action: inviteAction, personal_message: personalMessage.trim() || null }),
      };
      const url = isEdit ? `/api/teams/${teamId}/managers/${initialData!.id}` : `/api/teams/${teamId}/managers`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).error ?? "Error"); }
      toast({ title: isEdit ? mg.staffUpdated : "Manager added" });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : mg.failedAction, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ background: "hsl(226,40%,8%)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white tracking-wide">
            {(isEdit ? mg.editManager : mg.addManagerTitle).toUpperCase()}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pb-2">
          {/* Personal info */}
          <section className="space-y-3">
            <p className="stat-label text-white/50 uppercase tracking-widest">{mg.personalInfo}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="stat-label text-white/60 block mb-1.5">{mg.firstName} *</label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John"
                  className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl" />
              </div>
              <div>
                <label className="stat-label text-white/60 block mb-1.5">{mg.familyName} *</label>
                <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Smith"
                  className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl" />
              </div>
            </div>
            <div>
              <label className="stat-label text-white/60 block mb-1.5">{mg.roleTitle}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {TITLE_QUICK_PICKS.map(chip => (
                  <button key={chip} onClick={() => setCoachTitle(chip)}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold transition-all border"
                    style={coachTitle === chip
                      ? { background: `${teamColor}25`, color: teamColor, borderColor: `${teamColor}50` }
                      : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.15)" }
                    }>{chip}</button>
                ))}
              </div>
              <Input value={coachTitle} onChange={e => setCoachTitle(e.target.value)} placeholder={mg.coachTitlePlaceholder}
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl" />
            </div>
            <div>
              <label className="stat-label text-white/60 block mb-1.5">{mg.notesLabel}</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={mg.notesHelp} rows={2}
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl text-sm resize-none" />
            </div>
          </section>

          {/* Contact */}
          <section className="space-y-3">
            <p className="stat-label text-white/50 uppercase tracking-widest">{mg.contact}</p>
            <div>
              <label className="stat-label text-white/60 block mb-1.5">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coach@example.com"
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl" />
            </div>
            <div>
              <label className="stat-label text-white/60 block mb-1.5">Phone</label>
              <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000"
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl" />
            </div>
          </section>

          {/* Permissions */}
          <section className="space-y-3">
            <p className="stat-label text-white/50 uppercase tracking-widest">{mg.permissions}</p>
            <div>
              <p className="stat-label text-white/60 mb-2">{mg.permissionLevel}</p>
              <div className="grid grid-cols-2 gap-2">
                {([{ v: "coach", label: mg.roleCoachOpt }, { v: "assistant", label: mg.roleAssistantOpt }] as const).map(opt => (
                  <button key={opt.v} onClick={() => setRole(opt.v)}
                    className="rounded-xl py-2.5 px-3 text-sm font-semibold border transition-all"
                    style={role === opt.v
                      ? { background: `${teamColor}20`, borderColor: `${teamColor}50`, color: "white" }
                      : { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }
                    }>{opt.label}</button>
                ))}
              </div>
            </div>
            {role === "coach" && (
              <button onClick={() => setCanManage(p => !p)}
                className="w-full flex items-start gap-3 rounded-xl px-3 py-3 border transition-all text-start"
                style={canManage
                  ? { background: `${teamColor}15`, borderColor: `${teamColor}40` }
                  : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }
                }>
                {canManage
                  ? <ToggleRight className="h-4 w-4 shrink-0 mt-0.5" style={{ color: teamColor }} />
                  : <ToggleLeft className="h-4 w-4 shrink-0 mt-0.5 text-white/40" />
                }
                <div>
                  <p className="text-sm font-semibold text-white">{mg.canManageToggle}</p>
                  <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">{mg.canManageHelp}</p>
                </div>
              </button>
            )}
          </section>

          {/* Send invitation — only for new staff */}
          {!isEdit && (
            <section className="space-y-3">
              <p className="stat-label text-white/50 uppercase tracking-widest">{mg.sendInvitation}</p>
              <div className="space-y-2">
                {([
                  { v: "none", label: mg.inviteNone, icon: <User className="h-4 w-4" />, desc: "Add to staff list only" },
                  { v: "send_email", label: mg.inviteEmail, icon: <Mail className="h-4 w-4" />, desc: "They'll get an invite by email" },
                  { v: "generate_link", label: mg.inviteLink, icon: <Link2 className="h-4 w-4" />, desc: "Copy a link to share" },
                ] as const).map(opt => (
                  <button key={opt.v} onClick={() => setInviteAction(opt.v)}
                    className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm border transition-all"
                    style={inviteAction === opt.v
                      ? { background: `${teamColor}18`, borderColor: `${teamColor}50`, color: "white" }
                      : { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }
                    }>
                    <span style={{ color: inviteAction === opt.v ? teamColor : "rgba(255,255,255,0.4)" }}>{opt.icon}</span>
                    <div className="text-start">
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">{opt.desc}</p>
                    </div>
                    {inviteAction === opt.v && (
                      <span className="ms-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: teamColor }}>
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {inviteAction !== "none" && (
                <div>
                  <label className="stat-label text-white/60 block mb-1.5">{mg.personalMessage}</label>
                  <Textarea value={personalMessage} onChange={e => setPersonalMessage(e.target.value)} rows={2}
                    placeholder="Looking forward to working with you!"
                    className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl text-sm resize-none" />
                </div>
              )}
            </section>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 border border-white/15 text-white/60 rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 font-semibold rounded-xl h-10"
              style={{ background: teamColor, color: "white" }}>
              {loading ? "Saving…" : isEdit ? "Save Changes" : mg.addManager}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StaffRow({ coach, teamColor, isOwnerViewing, canManageSettings, onReload }: {
  coach: StaffMember; teamColor: string; isOwnerViewing: boolean;
  canManageSettings: boolean; onReload: () => void;
}) {
  const { t } = useI18n();
  const mg = t.management;
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { appUser } = useCurrentUser();

  const isMe = appUser?.clerkId === coach.clerkId;
  const RoleIcon = coach.isOwner ? Crown : (ROLE_ICONS[coach.role] ?? User);
  const roleColor = coach.isOwner ? "#f7b538" : "rgba(255,255,255,0.35)";

  async function handleRemove() {
    if (!confirm(mg.removeManagerConfirm?.replace("{name}", coach.name) ?? `Remove ${coach.name}?`)) return;
    const url = coach.userId
      ? `/api/teams/${coach.id}/placeholder-placeholder`
      : `/api/teams/${(window as any).__currentTeamId}/managers/${coach.id}`;
    const res = await fetch(
      coach.isPlaceholder
        ? `/api/teams/${(window as any).__currentTeamId}/managers/${coach.id}`
        : `/api/teams/${(window as any).__currentTeamId}/coaches/${coach.userId}`,
      { method: "DELETE" }
    );
    if (res.ok) { toast({ title: mg.staffUpdated }); onReload(); }
    else toast({ title: mg.failedAction, variant: "destructive" });
    setMenuOpen(false);
  }

  async function handleSendInvite(type: "send_email" | "generate_link") {
    const res = await fetch(`/api/teams/${(window as any).__currentTeamId}/managers/${coach.id}/send-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: type === "send_email" ? "email" : "link" }),
    });
    if (res.ok) {
      const data = await res.json();
      if (type === "generate_link" && data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {});
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast({ title: "Link copied to clipboard" });
      } else {
        toast({ title: "Invitation sent" });
      }
      onReload();
    } else toast({ title: mg.failedAction, variant: "destructive" });
    setMenuOpen(false);
  }

  async function handleCancelInvite() {
    const res = await fetch(`/api/teams/${(window as any).__currentTeamId}/managers/${coach.id}/cancel-invite`, { method: "POST" });
    if (res.ok) { toast({ title: "Invitation cancelled" }); onReload(); }
    else toast({ title: mg.failedAction, variant: "destructive" });
    setMenuOpen(false);
  }

  async function handleToggleSettings() {
    const res = await fetch(`/api/teams/${(window as any).__currentTeamId}/managers/${coach.userId ?? coach.id}/toggle-settings`, { method: "PATCH" });
    if (res.ok) { toast({ title: mg.staffUpdated }); onReload(); }
    else toast({ title: mg.failedAction, variant: "destructive" });
    setMenuOpen(false);
  }

  const showActions = canManageSettings && !isMe && !coach.isOwner;

  return (
    <>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: `${teamColor}25`, color: teamColor }}>
          {coach.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{coach.name}</p>
            {isMe && <span className="text-[10px] text-white/30">(you)</span>}
            {coach.isOwner && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#f7b53820", color: "#f7b538" }}>{mg.ownerBadge}</span>
            )}
            {!coach.isOwner && coach.canManageTeamSettings && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${teamColor}20`, color: teamColor }}>MGR</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <RoleIcon className="h-3 w-3 shrink-0" style={{ color: roleColor }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: roleColor }}>
              {coach.isOwner ? mg.youOwner : coach.role === "assistant" ? mg.roleAssistant : mg.roleCoach}
            </span>
            {coach.coachTitle && (
              <span className="text-[10px] text-white/40 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                {coach.coachTitle}
              </span>
            )}
          </div>
          {coach.email && <p className="text-xs text-white/35 mt-0.5 truncate">{coach.email}</p>}
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={coach.isPlaceholder ? (coach.status ?? "pending_invitation") : "active"} emailSendCount={coach.emailSendCount} createdAt={coach.createdAt} />
            {coach.canManageTeamSettings && !coach.isOwner && (
              <span className="text-[9px] text-white/40">✓ Can manage team settings</span>
            )}
          </div>
        </div>
        {showActions && (
          <div className="relative shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white"
              onClick={() => setMenuOpen(p => !p)}>
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-50 rounded-xl border border-white/10 overflow-hidden min-w-[180px]"
                style={{ background: "var(--surface-elevated)" }}>
                <button className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                  onClick={() => { setEditOpen(true); setMenuOpen(false); }}>
                  <Pencil className="h-3 w-3" />{mg.editManager}
                </button>
                {!coach.isPlaceholder && coach.phone && (
                  <a href={`https://wa.me/${coach.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                    onClick={() => setMenuOpen(false)}>
                    <MessageCircle className="h-3 w-3" />WhatsApp
                  </a>
                )}
                {!coach.isPlaceholder && coach.role === "coach" && (
                  <button className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                    onClick={handleToggleSettings}>
                    <Settings className="h-3 w-3" />{mg.toggleManage}
                  </button>
                )}
                {coach.isPlaceholder && (coach.status === "pending_invitation" || coach.status === "invited") && (
                  <>
                    {coach.email && (
                      <button className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                        onClick={() => handleSendInvite("send_email")}>
                        <Mail className="h-3 w-3" />{mg.resendInvite}
                      </button>
                    )}
                    <button className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                      onClick={() => handleSendInvite("generate_link")}>
                      <Link2 className="h-3 w-3" />{copiedLink ? "Copied!" : mg.copyLink}
                    </button>
                    {coach.phone && (
                      <button className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                        onClick={() => { handleSendInvite("generate_link"); setMenuOpen(false); }}>
                        <MessageCircle className="h-3 w-3" />{mg.sendWhatsapp}
                      </button>
                    )}
                    {coach.status === "invited" && (
                      <button className="w-full px-3 py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-400/8 flex items-center gap-2 transition-colors"
                        onClick={handleCancelInvite}>
                        <Trash2 className="h-3 w-3" />{mg.cancelInvitation}
                      </button>
                    )}
                  </>
                )}
                {coach.isPlaceholder && coach.status === "pending_invitation" && (
                  <>
                    {coach.email && (
                      <button className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                        onClick={() => handleSendInvite("send_email")}>
                        <Send className="h-3 w-3" />Send Email Invite
                      </button>
                    )}
                    <button className="w-full px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/8 flex items-center gap-2 transition-colors"
                      onClick={() => handleSendInvite("generate_link")}>
                      <Link2 className="h-3 w-3" />Generate Link
                    </button>
                  </>
                )}
                <div className="border-t border-white/8 mt-1 pt-1">
                  <button className="w-full px-3 py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-400/8 flex items-center gap-2 transition-colors"
                    onClick={handleRemove}>
                    <Trash2 className="h-3 w-3" />{mg.removeManager}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <AddManagerDialog open={editOpen} onClose={() => setEditOpen(false)} teamId={(window as any).__currentTeamId}
        teamColor={teamColor} initialData={coach} onSaved={onReload} />
    </>
  );
}

export default function TeamManagementTab({
  teamId, teamColor, teamName, joinCode, isOwner, canManageSettings: canManageSettingsProp,
}: {
  teamId: number; teamColor: string; teamName: string; joinCode?: string; isOwner: boolean;
  canManageSettings?: boolean;
}) {
  (window as any).__currentTeamId = teamId;

  const { t } = useI18n();
  const mg = t.management;
  const ti = t.teamInvite;
  const { toast } = useToast();
  const { appUser } = useCurrentUser();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/coaches`);
      if (res.ok) {
        const data = await res.json();
        setStaff(Array.isArray(data) ? data : (data.coaches ?? []));
        setOwnerId(data.ownerId ?? null);
      }
    } finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => { loadData(); }, [loadData]);

  const myMember = staff.find(s => s.clerkId === appUser?.clerkId);
  const canManageSettings = canManageSettingsProp ?? (isOwner || (myMember?.canManageTeamSettings === true));
  const otherCoaches = staff.filter(c => !c.isOwner && c.clerkId !== appUser?.clerkId && !c.isPlaceholder && c.userId !== null);

  async function transferOwnership() {
    if (!transferTargetId) return;
    setTransferLoading(true);
    const res = await fetch(`/api/teams/${teamId}/transfer-ownership`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerId: parseInt(transferTargetId), confirm: true }),
    });
    if (res.ok) { toast({ title: mg.ownershipTransferred }); setTransferOpen(false); loadData(); }
    else toast({ title: mg.failedAction, variant: "destructive" });
    setTransferLoading(false);
  }

  async function archiveTeam() {
    setArchiveLoading(true);
    const res = await fetch(`/api/teams/${teamId}/archive`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: archiveReason || null }),
    });
    if (res.ok) { toast({ title: mg.teamArchived }); setArchiveOpen(false); }
    else toast({ title: mg.failedAction, variant: "destructive" });
    setArchiveLoading(false);
  }

  async function deleteTeam() {
    if (deletePhrase !== "DELETE PERMANENTLY") return;
    setDeleteLoading(true);
    const res = await fetch(`/api/teams/${teamId}/destroy`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmPhrase: "DELETE PERMANENTLY" }),
    });
    if (res.ok) { toast({ title: mg.teamDeleted }); window.location.href = "/teams"; }
    else toast({ title: mg.failedAction, variant: "destructive" });
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

  return (
    <div className="space-y-6">
      {/* Coaching Staff */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
        <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4" style={{ color: teamColor }} />
            <p className="font-semibold text-white text-sm">{mg.coachingStaff} {!loading && `(${staff.length})`}</p>
          </div>
          {canManageSettings && (
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}
              className="text-xs text-white/50 hover:text-white border border-white/10 rounded-xl">
              <Plus className="h-3 w-3 me-1" />{mg.addManagerButton}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
          </div>
        ) : staff.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-white/30">{mg.noCoaches}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {staff.map(coach => (
              <StaffRow key={coach.id} coach={coach} teamColor={teamColor}
                isOwnerViewing={isOwner} canManageSettings={canManageSettings} onReload={loadData} />
            ))}
          </div>
        )}
      </div>

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
              <Button size="sm" variant="ghost" onClick={copyJoinCode}
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
            {otherCoaches.length > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white/80">{mg.transferOwnership}</p>
                  <p className="text-xs text-white/40 mt-0.5">{mg.confirmTransfer}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setTransferOpen(true)}
                  className="border border-white/15 text-white/60 hover:text-white rounded-xl shrink-0">
                  <ArrowRightLeft className="h-3.5 w-3.5 me-1.5" />{mg.transferOwnership}
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white/80">{mg.archiveTeam}</p>
                <p className="text-xs text-white/40 mt-0.5">{mg.confirmArchive}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setArchiveOpen(true)}
                className="border border-amber-500/30 text-amber-400/70 hover:text-amber-400 rounded-xl shrink-0">
                <Archive className="h-3.5 w-3.5 me-1.5" />{mg.archiveTeam}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-400/80">{mg.deleteTeam}</p>
                <p className="text-xs text-white/30 mt-0.5">Permanently destroy all team data</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}
                className="border border-red-500/30 text-red-400/70 hover:text-red-400 rounded-xl shrink-0">
                <Trash2 className="h-3.5 w-3.5 me-1.5" />{mg.deleteTeam}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manager Dialog */}
      <AddManagerDialog open={addOpen} onClose={() => setAddOpen(false)} teamId={teamId}
        teamColor={teamColor} onSaved={loadData} />

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">{mg.transferOwnership.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {otherCoaches.map(c => (
                <button key={c.userId} onClick={() => setTransferTargetId(String(c.userId))}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all"
                  style={transferTargetId === String(c.userId)
                    ? { background: `${teamColor}15`, borderColor: `${teamColor}40` }
                    : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }
                  }>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: `${teamColor}25`, color: teamColor }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-white">{c.name}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setTransferOpen(false)} className="flex-1 border border-white/10 text-white/50 rounded-xl">Cancel</Button>
              <Button onClick={transferOwnership} disabled={!transferTargetId || transferLoading}
                className="flex-1 font-semibold rounded-xl h-10" style={{ background: teamColor, color: "white" }}>
                {transferLoading ? "…" : mg.transferOwnership}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">{mg.archiveTeam.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-white/60">{mg.confirmArchive}</p>
            <Input value={archiveReason} onChange={e => setArchiveReason(e.target.value)}
              placeholder={mg.archiveReasonPlaceholder} className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setArchiveOpen(false)} className="flex-1 border border-white/10 text-white/50 rounded-xl">Cancel</Button>
              <Button onClick={archiveTeam} disabled={archiveLoading}
                className="flex-1 font-semibold rounded-xl h-10 bg-amber-500/80 hover:bg-amber-500 text-white">
                {archiveLoading ? "…" : mg.archiveTeam}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-red-400 tracking-wide">{mg.deleteTeam.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-white/60">{mg.deleteConfirmPhrase}</p>
            <Input value={deletePhrase} onChange={e => setDeletePhrase(e.target.value)}
              placeholder={mg.deletePhrasePlaceholder} className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl font-mono" />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} className="flex-1 border border-white/10 text-white/50 rounded-xl">Cancel</Button>
              <Button onClick={deleteTeam} disabled={deletePhrase !== "DELETE PERMANENTLY" || deleteLoading}
                className="flex-1 font-semibold rounded-xl h-10 bg-red-500/80 hover:bg-red-500 text-white">
                {deleteLoading ? "…" : mg.deleteTeam}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
