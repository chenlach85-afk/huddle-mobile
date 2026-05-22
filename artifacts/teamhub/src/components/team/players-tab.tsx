import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Users, MoreVertical, Mail, Link2, Copy, Check, Phone,
  UserX, UserCheck, Trash2, Pencil, Send, RefreshCw, MessageCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { apiFetch } from "@/lib/apiFetch";

type RosterMember = {
  id: number;
  teamId: number;
  userId: number | null;
  role: "coach" | "player" | "assistant";
  status: "active" | "inactive" | "pending_invitation" | "invited" | "declined" | null;
  placeholderFullName: string | null;
  placeholderEmail: string | null;
  placeholderPhone: string | null;
  invitationId: number | null;
  jerseyNumber: number | null;
  position: string | null;
  memberNotes: string | null;
  coachTitle: string | null;
  createdAt: string;
  displayName: string;
  displayEmail: string | null;
  displayPhone: string | null;
  invitationUrl: string | null;
  invitationToken: string | null;
  invitationStatus: string | null;
  invitationSendCount: number | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  active:               { bg: "rgba(46,204,113,0.12)",  text: "#2ecc71", border: "rgba(46,204,113,0.25)",  label: "active" },
  inactive:             { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.3)", border: "rgba(255,255,255,0.1)", label: "inactive" },
  pending_invitation:   { bg: "rgba(243,156,18,0.12)",  text: "#f39c12", border: "rgba(243,156,18,0.25)",  label: "statusPendingInvitation" },
  invited:              { bg: "rgba(52,152,219,0.12)",  text: "#3498db", border: "rgba(52,152,219,0.25)",  label: "statusInvited" },
  declined:             { bg: "rgba(231,76,60,0.12)",   text: "#e74c3c", border: "rgba(231,76,60,0.25)",   label: "statusDeclined" },
};

function getWhatsAppUrl(phone: string, name: string, teamName: string): string {
  const normalized = phone.replace(/[^\d+]/g, "");
  const msg = `Hi ${name}! Coach is checking in about the upcoming game for ${teamName}.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
}

export default function PlayersTab({
  teamId,
  teamColor,
  teamName,
}: {
  teamId: number;
  teamColor: string;
  teamName?: string;
}) {
  const { t } = useI18n();
  const p = t.players;
  const { toast } = useToast();

  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "pending">("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<RosterMember | null>(null);
  const [inviteResult, setInviteResult] = useState<{ url: string; emailSent: boolean; emailError: string | null } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const [form, setForm] = useState({
    fullName: "", jerseyNumber: "", position: "", email: "", phone: "", notes: "",
    invitationAction: "none" as "none" | "send_email" | "generate_link",
    personalMessage: "",
  });

  const resetForm = () => setForm({
    fullName: "", jerseyNumber: "", position: "", email: "", phone: "", notes: "",
    invitationAction: "none", personalMessage: "",
  });

  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/teams/${teamId}/roster`);
      if (res.ok) {
        const all: RosterMember[] = await res.json();
        setMembers(all.filter(m => m.role === "player"));
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const filtered = members.filter(m => {
    if (filter === "active") return m.status === "active";
    if (filter === "pending") return m.status === "pending_invitation" || m.status === "invited" || m.status === "declined";
    return true;
  });

  async function handleAdd() {
    if (!form.fullName.trim()) return;
    setSubmitting(true);
    setInviteResult(null);
    try {
      const res = await apiFetch(`/api/teams/${teamId}/roster`, {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          jerseyNumber: form.jerseyNumber ? parseInt(form.jerseyNumber) : undefined,
          position: form.position || undefined,
          notes: form.notes || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          invitationAction: form.invitationAction,
          personalMessage: form.personalMessage || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: p.playerAdded });
        loadRoster();
        if (data.inviteUrl) {
          setInviteResult({ url: data.inviteUrl, emailSent: data.emailSent, emailError: data.emailError });
          if (data.emailSent) toast({ title: p.emailSentSuccess });
          else if (data.emailError) {
            await navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
            toast({ title: p.emailFailed, variant: "destructive" });
          }
        } else {
          setAddOpen(false);
          resetForm();
        }
      } else {
        toast({ title: p.failedAdd, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit() {
    if (!editMember) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/teams/${teamId}/roster/${editMember.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.fullName || undefined,
          jerseyNumber: form.jerseyNumber ? parseInt(form.jerseyNumber) : null,
          position: form.position || null,
          notes: form.notes || null,
          email: form.email || null,
          phone: form.phone || null,
        }),
      });
      if (res.ok) {
        toast({ title: p.playerUpdated });
        setEditMember(null);
        loadRoster();
      } else toast({ title: p.failedUpdate, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(m: RosterMember) {
    setForm({
      fullName: m.displayName,
      jerseyNumber: m.jerseyNumber ? String(m.jerseyNumber) : "",
      position: m.position ?? "",
      email: m.displayEmail ?? "",
      phone: m.displayPhone ?? "",
      notes: m.memberNotes ?? "",
      invitationAction: "none",
      personalMessage: "",
    });
    setEditMember(m);
  }

  async function sendInvite(m: RosterMember, method: "email" | "link") {
    const res = await apiFetch(`/api/teams/${teamId}/roster/${m.id}/send-invite`, {
      method: "POST",
      body: JSON.stringify({ method }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.emailSent) toast({ title: p.inviteSent });
      else if (method === "link" && data.inviteUrl) {
        await navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
        toast({ title: p.inviteLinkCopied });
      } else if (data.emailError) {
        if (data.inviteUrl) {
          await navigator.clipboard.writeText(data.inviteUrl).catch(() => {});
        }
        toast({ title: `${p.emailFailed}: ${data.emailError}`, variant: "destructive" });
      }
      loadRoster();
    } else toast({ title: t.common.error, variant: "destructive" });
  }

  async function cancelInvite(m: RosterMember) {
    const res = await apiFetch(`/api/teams/${teamId}/roster/${m.id}/cancel-invite`, { method: "POST" });
    if (res.ok) { toast({ title: p.inviteCancelled }); loadRoster(); }
  }

  async function deactivate(m: RosterMember) {
    const res = await apiFetch(`/api/teams/${teamId}/roster/${m.id}/deactivate`, { method: "POST" });
    if (res.ok) { toast({ title: p.deactivated }); loadRoster(); }
  }

  async function reactivate(m: RosterMember) {
    const res = await apiFetch(`/api/teams/${teamId}/roster/${m.id}/reactivate`, { method: "POST" });
    if (res.ok) { toast({ title: p.reactivated }); loadRoster(); }
  }

  async function removeMember(m: RosterMember) {
    if (!confirm(p.confirmRemove)) return;
    const res = await apiFetch(`/api/teams/${teamId}/roster/${m.id}`, { method: "DELETE" });
    if (res.ok) { toast({ title: p.playerRemoved }); loadRoster(); }
    else toast({ title: p.failedRemove, variant: "destructive" });
  }

  async function copyLink(m: RosterMember) {
    if (!m.invitationUrl) return;
    await navigator.clipboard.writeText(m.invitationUrl).catch(() => {});
    setCopiedId(m.id);
    toast({ title: p.inviteLinkCopied });
    setTimeout(() => setCopiedId(null), 2000);
  }

  const statusStyle = (status: string | null) => STATUS_STYLES[status ?? "pending_invitation"] ?? STATUS_STYLES.pending_invitation;
  const statusLabel = (status: string | null) => {
    const key = statusStyle(status).label as keyof typeof p;
    return (p[key] as string | undefined) ?? status ?? "—";
  };

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "all", label: p.filterAll },
    { key: "active", label: p.filterActive },
    { key: "pending", label: p.filterPending },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
        <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: teamColor }} />
            <p className="font-semibold text-white text-sm">
              {members.length} {p.rosterCount}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => { resetForm(); setInviteResult(null); setAddOpen(true); }}
            className="text-xs font-semibold rounded-xl text-white"
            style={{ background: teamColor }}
          >
            <Plus className="h-3.5 w-3.5 me-1" />
            {p.addPlayerTitle}
          </Button>
        </div>

        {/* Filter chips */}
        <div className="px-4 py-2 flex gap-1.5 border-b border-white/4">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
              style={filter === f.key
                ? { background: `${teamColor}25`, color: teamColor, border: `1px solid ${teamColor}40` }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Roster list */}
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <Users className="h-8 w-8 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/30 font-semibold">{p.emptySquad}</p>
            <p className="text-xs text-white/20 mt-1">{p.addToGetStarted}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/4">
            {filtered.map(m => {
              const ss = statusStyle(m.status);
              const isRegistered = m.userId !== null;
              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: `${teamColor}20`, color: teamColor }}
                  >
                    {m.jerseyNumber != null
                      ? <span className="text-xs font-bold ltr-num">{m.jerseyNumber}</span>
                      : m.displayName.charAt(0).toUpperCase()
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{m.displayName}</p>
                      {m.position && <span className="text-[10px] text-white/30 font-medium">{m.position}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {/* Status badge */}
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
                        style={{ background: ss.bg, color: ss.text, border: `1px solid ${ss.border}` }}>
                        {statusLabel(m.status)}
                      </span>
                      {/* Contact */}
                      {m.displayEmail && !isRegistered && (
                        <span className="text-[10px] text-white/30 truncate max-w-[120px]">{m.displayEmail}</span>
                      )}
                      {m.displayPhone && (
                        <a
                          href={getWhatsAppUrl(m.displayPhone, m.displayName, teamName ?? "the team")}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-[10px] text-green-400/60 hover:text-green-400 transition-colors"
                        >
                          <MessageCircle className="h-2.5 w-2.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      {/* Invite send count */}
                      {m.status === "invited" && m.invitationSendCount != null && m.invitationSendCount > 0 && (
                        <span className="text-[9px] text-blue-400/50">
                          {p.inviteResent.includes("resent") ? `Sent ${m.invitationSendCount}×` : `${m.invitationSendCount}×`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Quick copy link if invited */}
                    {m.invitationUrl && (m.status === "invited" || m.status === "pending_invitation") && (
                      <button
                        onClick={() => copyLink(m)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/8"
                        title={p.inviteLinkCopied}
                      >
                        {copiedId === m.id
                          ? <Check className="h-3 w-3 text-green-400" />
                          : <Link2 className="h-3 w-3 text-white/30" />
                        }
                      </button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors">
                          <MoreVertical className="h-3.5 w-3.5 text-white/40" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-border text-sm" style={{ background: "var(--surface-elevated)" }}>
                        <DropdownMenuItem onClick={() => openEdit(m)} className="text-white/80 cursor-pointer">
                          <Pencil className="h-3.5 w-3.5 me-2" />{p.editPlayer}
                        </DropdownMenuItem>

                        {!isRegistered && (
                          <>
                            <DropdownMenuSeparator className="bg-white/6" />
                            {m.displayEmail && (
                              <DropdownMenuItem onClick={() => sendInvite(m, "email")} className="text-blue-400 cursor-pointer">
                                <Mail className="h-3.5 w-3.5 me-2" />
                                {m.status === "invited" ? p.resendInvite : p.sendInvite}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => sendInvite(m, "link")} className="text-white/60 cursor-pointer">
                              <Link2 className="h-3.5 w-3.5 me-2" />{p.inviteGenerateLink}
                            </DropdownMenuItem>
                            {m.status === "invited" && (
                              <DropdownMenuItem onClick={() => cancelInvite(m)} className="text-amber-400/70 cursor-pointer">
                                <RefreshCw className="h-3.5 w-3.5 me-2" />{p.cancelInvite}
                              </DropdownMenuItem>
                            )}
                          </>
                        )}

                        {isRegistered && (
                          <>
                            <DropdownMenuSeparator className="bg-white/6" />
                            {m.status === "active"
                              ? <DropdownMenuItem onClick={() => deactivate(m)} className="text-amber-400/70 cursor-pointer">
                                  <UserX className="h-3.5 w-3.5 me-2" />{p.deactivate}
                                </DropdownMenuItem>
                              : <DropdownMenuItem onClick={() => reactivate(m)} className="text-green-400/70 cursor-pointer">
                                  <UserCheck className="h-3.5 w-3.5 me-2" />{p.reactivate}
                                </DropdownMenuItem>
                            }
                          </>
                        )}

                        <DropdownMenuSeparator className="bg-white/6" />
                        <DropdownMenuItem onClick={() => removeMember(m)} className="text-red-400 cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5 me-2" />{p.removePlayer}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Player Dialog */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) { resetForm(); setInviteResult(null); } }}>
        <DialogContent className="max-w-sm border-border max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">{p.addPlayerTitle.toUpperCase()}</DialogTitle>
          </DialogHeader>

          {inviteResult ? (
            <div className="space-y-4">
              {inviteResult.emailSent ? (
                <div className="rounded-xl p-4 text-center" style={{ background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)" }}>
                  <Check className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-400">{p.emailSentSuccess}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-white/50">{p.inviteGenerateLink}</p>
                  <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-xs text-white/60 font-mono flex-1 truncate">{inviteResult.url}</p>
                    <button onClick={async () => {
                      await navigator.clipboard.writeText(inviteResult.url).catch(() => {});
                      toast({ title: p.inviteLinkCopied });
                    }} className="p-1 rounded hover:bg-white/10">
                      <Copy className="h-3.5 w-3.5 text-white/50" />
                    </button>
                  </div>
                  {inviteResult.emailError && (
                    <p className="text-xs text-red-400/70">{inviteResult.emailError}</p>
                  )}
                </div>
              )}
              <Button className="w-full rounded-xl font-semibold" variant="ghost"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                onClick={() => { resetForm(); setInviteResult(null); }}>
                {t.common.add} {p.addPlayerTitle.split(" ")[1] ?? "another"}
              </Button>
              <Button className="w-full rounded-xl font-semibold" style={{ background: teamColor, color: "white" }}
                onClick={() => { setAddOpen(false); resetForm(); setInviteResult(null); }}>
                {t.common.close}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="stat-label text-white/50 block mb-1">{p.fullName} *</label>
                <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="John Smith"
                  className="bg-white/6 border-white/10 text-white placeholder:text-white/20 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="stat-label text-white/50 block mb-1">{p.jerseyNumber}</label>
                  <Input type="number" value={form.jerseyNumber} onChange={e => setForm(f => ({ ...f, jerseyNumber: e.target.value }))}
                    placeholder="10"
                    className="bg-white/6 border-white/10 text-white placeholder:text-white/20 rounded-xl" />
                </div>
                <div>
                  <label className="stat-label text-white/50 block mb-1">{p.position}</label>
                  <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    placeholder="FW"
                    className="bg-white/6 border-white/10 text-white placeholder:text-white/20 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="stat-label text-white/50 block mb-1">{p.email}</label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="player@example.com"
                  className="bg-white/6 border-white/10 text-white placeholder:text-white/20 rounded-xl" />
              </div>
              <div>
                <label className="stat-label text-white/50 block mb-1">{p.phone}</label>
                <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 555 0100"
                  className="bg-white/6 border-white/10 text-white placeholder:text-white/20 rounded-xl" />
              </div>
              <div>
                <label className="stat-label text-white/50 block mb-1">{p.notes}</label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes about this player…"
                  rows={2}
                  className="bg-white/6 border-white/10 text-white placeholder:text-white/20 rounded-xl resize-none" />
              </div>

              {/* Invitation action */}
              <div>
                <label className="stat-label text-white/50 block mb-1.5">{p.invitationActionLabel}</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(["none", "send_email", "generate_link"] as const).map(action => (
                    <button
                      key={action}
                      onClick={() => setForm(f => ({ ...f, invitationAction: action }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                      style={form.invitationAction === action
                        ? { background: `${teamColor}25`, color: teamColor, borderColor: `${teamColor}50` }
                        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)" }
                      }
                    >
                      {action === "none" && <><span className="me-1">—</span>{p.inviteNone}</>}
                      {action === "send_email" && <><Mail className="h-3 w-3 inline me-1" />{p.inviteSendEmail}</>}
                      {action === "generate_link" && <><Link2 className="h-3 w-3 inline me-1" />{p.inviteGenerateLink}</>}
                    </button>
                  ))}
                </div>
                {form.invitationAction === "send_email" && !form.email && (
                  <p className="text-xs text-amber-400/70 mt-1">Add an email address above to send an invite.</p>
                )}
              </div>

              {form.invitationAction !== "none" && (
                <div>
                  <label className="stat-label text-white/50 block mb-1">{p.personalMessage}</label>
                  <Input value={form.personalMessage} onChange={e => setForm(f => ({ ...f, personalMessage: e.target.value }))}
                    placeholder={p.personalMessagePlaceholder}
                    className="bg-white/6 border-white/10 text-white placeholder:text-white/20 rounded-xl" />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1 rounded-xl border border-white/10 text-white/50"
                  onClick={() => { setAddOpen(false); resetForm(); }}>
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={submitting || !form.fullName.trim()}
                  className="flex-1 rounded-xl font-semibold"
                  style={{ background: teamColor, color: "white" }}>
                  <Send className="h-3.5 w-3.5 me-1.5" />
                  {submitting ? t.common.saving : p.addToSquad}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Player Dialog */}
      <Dialog open={!!editMember} onOpenChange={open => { if (!open) setEditMember(null); }}>
        <DialogContent className="max-w-sm border-border max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">{p.editAthlete.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editMember?.userId === null && (
              <div>
                <label className="stat-label text-white/50 block mb-1">{p.fullName}</label>
                <Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className="bg-white/6 border-white/10 text-white rounded-xl" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="stat-label text-white/50 block mb-1">{p.jerseyNumber}</label>
                <Input type="number" value={form.jerseyNumber} onChange={e => setForm(f => ({ ...f, jerseyNumber: e.target.value }))}
                  className="bg-white/6 border-white/10 text-white rounded-xl" />
              </div>
              <div>
                <label className="stat-label text-white/50 block mb-1">{p.position}</label>
                <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  className="bg-white/6 border-white/10 text-white rounded-xl" />
              </div>
            </div>
            {editMember?.userId === null && (
              <>
                <div>
                  <label className="stat-label text-white/50 block mb-1">{p.email}</label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-white/6 border-white/10 text-white rounded-xl" />
                </div>
                <div>
                  <label className="stat-label text-white/50 block mb-1">{p.phone}</label>
                  <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="bg-white/6 border-white/10 text-white rounded-xl" />
                </div>
              </>
            )}
            <div>
              <label className="stat-label text-white/50 block mb-1">{p.notes}</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="bg-white/6 border-white/10 text-white rounded-xl resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1 rounded-xl border border-white/10 text-white/50"
                onClick={() => setEditMember(null)}>
                {t.common.cancel}
              </Button>
              <Button onClick={handleEdit} disabled={submitting}
                className="flex-1 rounded-xl font-semibold" style={{ background: teamColor, color: "white" }}>
                {submitting ? t.common.saving : t.common.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
