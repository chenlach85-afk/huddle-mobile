import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail, Copy, Check, Send, Trash2, Clock, CheckCircle2, XCircle, AlertCircle,
  ShieldCheck, Users, ArrowLeft, Plus, TriangleAlert, Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";

const DATE_LOCALES = { he, es, en: enUS };
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Invitation = {
  id: number;
  token: string;
  email: string;
  invitedRole: "coach" | "admin";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  inviterName: string | null;
};

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

function getInviteLink(token: string) {
  const domain = window.location.origin;
  return `${domain}${basePath}/invite/${token}`;
}

const STATUS_CONFIG = {
  pending:  { icon: Clock,        color: "#f7b538", bg: "rgba(247,181,56,0.12)"  },
  accepted: { icon: CheckCircle2, color: "#2ecc71", bg: "rgba(46,204,113,0.12)" },
  revoked:  { icon: XCircle,      color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  expired:  { icon: AlertCircle,  color: "rgba(255,255,255,0.3)", bg: "rgba(255,255,255,0.05)" },
};

function StatusBadge({ status, label }: { status: keyof typeof STATUS_CONFIG; label: string }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const inv = t.invitations;
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy}
      className="inline-flex items-center gap-1 text-xs rounded-lg px-2 py-1 transition-colors"
      style={{ background: copied ? "rgba(46,204,113,0.12)" : "rgba(255,255,255,0.06)", color: copied ? "#2ecc71" : "rgba(255,255,255,0.5)" }}>
      {copied ? <><Check className="h-3 w-3" />{inv.copied}</> : <><Copy className="h-3 w-3" />{inv.copyLink}</>}
    </button>
  );
}

/* ── Send Invitation Form ── */
function SendInvitationForm({ onSent }: { onSent: () => void }) {
  const { t } = useI18n();
  const inv = t.invitations;
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"coach" | "admin">("coach");
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function handleSend() {
    if (!email || !email.includes("@")) {
      toast({ title: "Valid email required", variant: "destructive" }); return;
    }
    setSending(true);
    try {
      const data = await apiFetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      }) as { inviteLink: string; emailSent: boolean };
      setLastLink(data.inviteLink);
      toast({ title: data.emailSent ? inv.emailSent : inv.noEmail });
      setEmail("");
      setRole("coach");
      onSent();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl p-6 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h2 className="font-display text-xl text-white">{inv.sendInvitation}</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={inv.emailAddress}
          className="bg-white/6 border-white/10 text-white rounded-xl placeholder:text-white/30"
          onKeyDown={e => e.key === "Enter" && handleSend()}
        />
        <div dir="ltr" className="min-w-[160px]">
          <Select value={role} onValueChange={v => setRole(v as "coach" | "admin")}>
            <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
              <SelectItem value="coach" className="text-white">
                <span className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-blue-400" />{inv.roleCoach}</span>
              </SelectItem>
              <SelectItem value="admin" className="text-white">
                <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-primary" />{inv.roleAdmin}</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSend} disabled={sending}
          className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-10 px-5 gap-2">
          <Send className="h-4 w-4" />
          {sending ? inv.sending : inv.sendInvitation}
        </Button>
      </div>

      {lastLink && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)" }}>
          <p className="text-xs text-white/50 font-medium">{inv.linkReady}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-primary truncate bg-black/20 rounded-lg px-3 py-1.5 font-mono">{lastLink}</code>
            <CopyButton text={lastLink} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Invitation Row ── */
function InvitationRow({ inv: invitation, onRevoke, onResent }: { inv: Invitation; onRevoke: () => void; onResent: () => void }) {
  const { t, language } = useI18n();
  const inv = t.invitations;
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [resending, setResending] = useState(false);
  const dateLocale = DATE_LOCALES[language] ?? enUS;

  const statusLabel = {
    pending: inv.pending, accepted: inv.accepted, revoked: inv.revoked, expired: inv.expired
  }[invitation.status] ?? invitation.status;

  const roleLabel = invitation.invitedRole === "admin" ? inv.roleAdmin : inv.roleCoach;

  async function handleRevoke() {
    setRevoking(true);
    try {
      await apiFetch(`/api/admin/invitations/${invitation.id}`, { method: "DELETE" });
      toast({ title: inv.revoke + " ✓" });
      setConfirmOpen(false);
      onRevoke();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await apiFetch(`/api/admin/invitations/${invitation.id}/resend`, { method: "POST" });
      toast({ title: inv.emailSent + " ✓" });
      onResent();
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <div className="px-5 py-3.5 flex items-center gap-3 hover:bg-white/2 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,107,53,0.1)" }}>
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{invitation.email}</p>
            <StatusBadge status={invitation.status} label={statusLabel} />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ background: invitation.invitedRole === "admin" ? "rgba(255,107,53,0.15)" : "rgba(74,144,226,0.15)", color: invitation.invitedRole === "admin" ? "#FF6B35" : "#4a90e2" }}>
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {invitation.inviterName && (
              <p className="text-xs text-white/35">by {invitation.inviterName}</p>
            )}
            <p className="text-[10px] text-white/25 ltr-num">
              {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true, locale: dateLocale })}
            </p>
            {invitation.emailSentAt ? (
              <span className="text-[10px] text-green-400/60 flex items-center gap-0.5">
                <Check className="h-2.5 w-2.5" /> {inv.emailSent}
              </span>
            ) : invitation.status === "pending" ? (
              <span className="text-[10px] text-yellow-400/70 flex items-center gap-0.5">
                <TriangleAlert className="h-2.5 w-2.5" /> {inv.linkNotSent}
              </span>
            ) : null}
          </div>

          {/* Expanded link row for un-emailed pending invitations */}
          {invitation.status === "pending" && !invitation.emailSentAt && (
            <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ background: "rgba(247,181,56,0.06)", border: "1px solid rgba(247,181,56,0.15)" }}>
              <Link2 className="h-3 w-3 text-yellow-400/60 shrink-0" />
              <code className="flex-1 text-[11px] text-yellow-300/70 truncate font-mono">{getInviteLink(invitation.token)}</code>
              <CopyButton text={getInviteLink(invitation.token)} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {invitation.status === "pending" && (
            <button
              onClick={handleResend}
              disabled={resending}
              title={inv.resendEmail}
              className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40">
              {resending ? <span className="text-[10px] text-blue-400">…</span> : <Mail className="h-3.5 w-3.5" />}
            </button>
          )}
          {invitation.status === "pending" && invitation.emailSentAt && (
            <CopyButton text={getInviteLink(invitation.token)} />
          )}
          {invitation.status === "pending" && (
            <button onClick={() => setConfirmOpen(true)}
              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white">{inv.revokeConfirm}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/50">{invitation.email}</p>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="flex-1 text-white/50">
              {t.common.cancel}
            </Button>
            <Button onClick={handleRevoke} disabled={revoking}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">
              {revoking ? "…" : inv.revoke}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Main Page ── */
export default function AdminInvitationsPage() {
  const { t } = useI18n();
  const inv = t.invitations;
  const qc = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ["admin-invitations"],
    queryFn: () => apiFetch("/api/admin/invitations") as Promise<Invitation[]>,
  });

  const { data: emailStatus } = useQuery<{ emailConfigured: boolean }>({
    queryKey: ["admin-invitations-email-status"],
    queryFn: () => apiFetch("/api/admin/invitations/email-status") as Promise<{ emailConfigured: boolean }>,
    staleTime: 60_000,
  });

  const emailConfigured = emailStatus?.emailConfigured ?? true;

  function refresh() { qc.invalidateQueries({ queryKey: ["admin-invitations"] }); }

  const stats = {
    pending:  invitations.filter(i => i.status === "pending").length,
    accepted: invitations.filter(i => i.status === "accepted").length,
    revoked:  invitations.filter(i => i.status === "revoked").length,
    expired:  invitations.filter(i => i.status === "expired").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <button className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <div>
          <h1 className="font-display text-3xl text-white">{inv.title}</h1>
          <p className="text-sm text-white/40">{t.admin.subtitle}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {([
          { key: "pending", label: inv.pending, color: "#f7b538" },
          { key: "accepted", label: inv.accepted, color: "#2ecc71" },
          { key: "expired", label: inv.expired, color: "rgba(255,255,255,0.3)" },
          { key: "revoked", label: inv.revoked, color: "#ef4444" },
        ] as const).map(({ key, label, color }) => (
          <div key={key} className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="font-display text-2xl" style={{ color }}>{stats[key]}</p>
            <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Email not configured warning */}
      {emailStatus && !emailConfigured && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: "rgba(247,181,56,0.08)", border: "1px solid rgba(247,181,56,0.25)" }}>
          <TriangleAlert className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-300/80 leading-relaxed">{inv.emailNotConfigured}</p>
        </div>
      )}

      {/* Send form */}
      <SendInvitationForm onSent={refresh} />

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-5 py-3 border-b border-white/6 flex items-center justify-between">
          <h2 className="font-display text-lg text-white/80">{inv.title}</h2>
          <button onClick={refresh} className="text-xs text-white/30 hover:text-white/60 transition-colors">↻</button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-white/30 text-sm">Loading…</div>
        ) : invitations.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Plus className="h-8 w-8 text-white/10 mx-auto" />
            <p className="text-sm text-white/30">{inv.noInvitations}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {invitations.map(i => (
              <InvitationRow key={i.id} inv={i} onRevoke={refresh} onResent={refresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
