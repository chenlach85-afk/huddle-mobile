import { useState, useCallback, useMemo } from "react";
import { useTheme } from "@/lib/useTheme";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, BarChart3, ShieldCheck, AlertCircle, TrendingUp, Calendar,
  CheckSquare, MessageSquare, MoreVertical, Search, UserX, UserCheck,
  Trash2, Edit3, ClipboardList, Shield, Activity, Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";

const DATE_LOCALES = { he, es, en: enUS };

type AccountStatus = "active" | "suspended" | "deleted";
type TeamAction = "archive" | "transfer" | "delete";

type AdminUser = {
  id: number;
  clerkId: string;
  email: string;
  name: string;
  role: "coach" | "player" | "admin";
  language: string;
  accountStatus: AccountStatus;
  deletedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  deletionReason: string | null;
  createdAt: string;
};

type AdminKpis = {
  totalUsers: number;
  totalTeams: number;
  totalEvents: number;
  totalTasks: number;
  totalMessages: number;
  activeUsers: number;
  recentUsers: AdminUser[];
};

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

const STATUS_COLORS: Record<AccountStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "rgba(46,204,113,0.15)", text: "#2ecc71", label: "" },
  suspended: { bg: "rgba(247,181,56,0.15)", text: "#f7b538", label: "" },
  deleted: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.3)", label: "" },
};

function StatusBadge({ status, ad }: { status: AccountStatus; ad: ReturnType<typeof useI18n>["t"]["admin"] }) {
  const c = STATUS_COLORS[status];
  const label = status === "active" ? ad.statusActive : status === "suspended" ? ad.statusSuspended : ad.statusDeleted;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
      style={{ background: c.bg, color: c.text }}>
      {label}
    </span>
  );
}

function RoleBadge({ role, ad }: { role: string; ad: ReturnType<typeof useI18n>["t"]["admin"] }) {
  const colors = {
    admin: { bg: "rgba(255,107,53,0.15)", text: "#FF6B35" },
    coach: { bg: "rgba(74,144,226,0.15)", text: "#4a90e2" },
    player: { bg: "rgba(46,204,113,0.15)", text: "#2ecc71" },
  };
  const c = colors[role as keyof typeof colors] ?? colors.player;
  const label = role === "admin" ? ad.admin : role === "coach" ? ad.coach : ad.player;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1"
      style={{ background: c.bg, color: c.text }}>
      {role === "admin" && <Shield className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

/* ──────────── Suspend modal ──────────── */
function SuspendModal({ user, open, onClose, onDone }: {
  user: AdminUser; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const ad = t.admin;
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function handle() {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}/suspend`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      toast({ title: ad.userSuspended });
      onDone();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border" style={{ background: "var(--surface-card)" }}>
        <DialogHeader><DialogTitle className="font-display text-2xl text-white">{ad.suspendTitle}</DialogTitle></DialogHeader>
        <p className="text-sm text-white/50">{ad.suspendWarning}</p>
        <p className="text-xs text-yellow-400/80 font-semibold">— {user.name} ({user.email})</p>
        <div className="space-y-3">
          <label className="stat-label text-white/50 block">{ad.suspendReason}</label>
          <Input value={reason} onChange={e => setReason(e.target.value)}
            className="bg-white/6 border-white/10 text-white rounded-xl" />
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50">{t.common.cancel}</Button>
            <Button onClick={handle} disabled={saving}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl">
              {saving ? "…" : ad.suspendBtn}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────── Reactivate modal ──────────── */
function ReactivateModal({ user, open, onClose, onDone }: {
  user: AdminUser; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const ad = t.admin;
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  async function handle() {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}/reactivate`, { method: "POST" });
      toast({ title: ad.userReactivated });
      onDone();
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border" style={{ background: "var(--surface-card)" }}>
        <DialogHeader><DialogTitle className="font-display text-2xl text-white">{ad.reactivateTitle}</DialogTitle></DialogHeader>
        <p className="text-sm text-white/50">{ad.reactivateWarning}</p>
        <p className="text-xs text-green-400/80 font-semibold">— {user.name} ({user.email})</p>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50">{t.common.cancel}</Button>
          <Button onClick={handle} disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl">
            {saving ? "…" : ad.reactivateBtn}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────── Soft delete modal ──────────── */
function SoftDeleteModal({ user, open, onClose, onDone, allUsers }: {
  user: AdminUser; open: boolean; onClose: () => void; onDone: () => void;
  allUsers: AdminUser[];
}) {
  const { t } = useI18n();
  const ad = t.admin;
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [teamAction, setTeamAction] = useState<TeamAction>("archive");
  const [transferToId, setTransferToId] = useState("");
  const [saving, setSaving] = useState(false);

  const activeUsers = allUsers.filter(u => u.id !== user.id && u.accountStatus === "active");

  async function handle() {
    if (teamAction === "transfer" && !transferToId) {
      toast({ title: "Select a user to transfer to", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}/soft-delete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason || undefined,
          teamAction,
          transferToUserId: teamAction === "transfer" ? parseInt(transferToId) : undefined,
        }),
      });
      toast({ title: ad.userDeleted });
      onDone();
    } catch (e: any) {
      const msg = e.message === "cannot_self_delete" ? ad.cannotSelfDelete : e.message;
      toast({ title: msg, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-border max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white">{ad.softDeleteTitle}</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl p-3 text-sm text-white/60 leading-relaxed"
          style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)" }}>
          {ad.softDeleteWarning}
        </div>
        <p className="text-xs text-orange-400/80 font-semibold">— {user.name} ({user.email})</p>
        <div className="space-y-4">
          <div>
            <label className="stat-label text-white/50 block mb-1.5">{ad.deleteReason}</label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              className="bg-white/6 border-white/10 text-white rounded-xl" />
          </div>
          <div>
            <label className="stat-label text-white/50 block mb-2">{ad.teamActionLabel}</label>
            <div className="space-y-2">
              {(["archive", "transfer", "delete"] as TeamAction[]).map(action => (
                <label key={action} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl transition-colors"
                  style={{ background: teamAction === action ? "rgba(255,107,53,0.1)" : "rgba(255,255,255,0.04)", border: teamAction === action ? "1px solid rgba(255,107,53,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                  <input type="radio" name="teamAction" value={action} checked={teamAction === action}
                    onChange={() => setTeamAction(action)} className="mt-0.5 accent-primary" />
                  <span className="text-sm text-white/80">
                    {action === "archive" ? ad.teamActionArchive : action === "transfer" ? ad.teamActionTransfer : ad.teamActionDelete}
                    {action === "delete" && <span className="block text-xs text-red-400 mt-0.5">⚠ Irreversible</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {teamAction === "transfer" && (
            <div dir="ltr">
              <label className="stat-label text-white/50 block mb-1.5">{ad.transferTo}</label>
              <Select value={transferToId} onValueChange={setTransferToId}>
                <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                  {activeUsers.map(u => (
                    <SelectItem key={u.id} value={String(u.id)} className="text-white text-xs">
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50">{t.common.cancel}</Button>
            <Button onClick={handle} disabled={saving}
              className="flex-1 font-bold rounded-xl"
              style={{ background: "#FF6B35", color: "white" }}>
              {saving ? "…" : ad.softDeleteBtn}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────── Hard delete modal ──────────── */
function HardDeleteModal({ user, open, onClose, onDone, allUsers }: {
  user: AdminUser; open: boolean; onClose: () => void; onDone: () => void;
  allUsers: AdminUser[];
}) {
  const { t } = useI18n();
  const ad = t.admin;
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [teamAction, setTeamAction] = useState<"delete" | "transfer">("delete");
  const [transferToId, setTransferToId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  const activeUsers = allUsers.filter(u => u.id !== user.id && u.accountStatus === "active");
  const confirmMatch = confirmText === ad.hardDeleteConfirmPhrase;
  const canSubmit = confirmMatch && reason.trim().length >= 10 && !saving;

  async function handle() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}/hard-delete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          teamAction,
          transferToUserId: teamAction === "transfer" ? parseInt(transferToId) : undefined,
          confirmationText: confirmText,
        }),
      });
      toast({ title: "User permanently deleted" });
      onDone();
    } catch (e: any) {
      const msg = e.message === "cannot_self_delete" ? ad.cannotSelfDelete
        : e.message === "cannot_delete_last_admin" ? ad.cannotDemoteLastAdmin
        : e.message;
      toast({ title: msg, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg border-red-500/30 max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-red-400">{ad.hardDeleteTitle}</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl p-3 text-sm text-red-300/80 leading-relaxed"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {ad.hardDeleteWarning}
        </div>
        <p className="text-xs text-red-400/80 font-semibold">— {user.name} ({user.email})</p>
        <div className="space-y-4">
          <div>
            <label className="stat-label text-white/50 block mb-1.5">{ad.hardDeleteReason}</label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              className="bg-white/6 border-white/10 text-white rounded-xl"
              placeholder="Min 10 characters…" />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-red-400 mt-1">{10 - reason.length} more chars needed</p>
            )}
          </div>
          <div>
            <label className="stat-label text-white/50 block mb-2">{ad.teamActionLabel}</label>
            <div className="flex gap-2">
              {(["delete", "transfer"] as const).map(action => (
                <button key={action} onClick={() => setTeamAction(action)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: teamAction === action ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
                    color: teamAction === action ? "#ef4444" : "rgba(255,255,255,0.4)",
                    border: teamAction === action ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {action === "delete" ? ad.teamActionDelete : ad.teamActionTransfer}
                </button>
              ))}
            </div>
          </div>
          {teamAction === "transfer" && (
            <div dir="ltr">
              <Select value={transferToId} onValueChange={setTransferToId}>
                <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                  {activeUsers.map(u => (
                    <SelectItem key={u.id} value={String(u.id)} className="text-white text-xs">
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="stat-label text-white/50 block mb-1.5">{ad.hardDeleteConfirmLabel}</label>
            <Input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              className="bg-white/6 border-red-500/20 text-white rounded-xl font-mono"
              placeholder={ad.hardDeleteConfirmPhrase} />
            {confirmText.length > 0 && !confirmMatch && (
              <p className="text-xs text-red-400 mt-1">Must match exactly</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50">{t.common.cancel}</Button>
            <Button onClick={handle} disabled={!canSubmit}
              className="flex-1 font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white disabled:opacity-30">
              {saving ? "…" : ad.hardDeleteBtn}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────── Edit user modal ──────────── */
function EditUserModal({ user, open, onClose, onDone }: {
  user: AdminUser; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { t } = useI18n();
  const ad = t.admin;
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [language, setLanguage] = useState(user.language);
  const [saving, setSaving] = useState(false);

  async function handle() {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, language }),
      });
      toast({ title: ad.userEdited });
      onDone();
    } catch (e: any) {
      const msg = e.message === "cannot_self_demote" ? ad.cannotSelfDemote
        : e.message === "cannot_demote_last_admin" ? ad.cannotDemoteLastAdmin
        : e.message;
      toast({ title: msg, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border" style={{ background: "var(--surface-card)" }}>
        <DialogHeader><DialogTitle className="font-display text-2xl text-white">{ad.editUserTitle}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="stat-label text-white/50 block mb-1.5">{ad.name}</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              className="bg-white/6 border-white/10 text-white rounded-xl" />
          </div>
          <div dir="ltr">
            <label className="stat-label text-white/50 block mb-1.5">{ad.role}</label>
            <Select value={role} onValueChange={v => setRole(v as typeof role)}>
              <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                <SelectItem value="coach" className="text-white">{ad.coach}</SelectItem>
                <SelectItem value="player" className="text-white">{ad.player}</SelectItem>
                <SelectItem value="admin" className="text-white">{ad.admin}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div dir="ltr">
            <label className="stat-label text-white/50 block mb-1.5">Language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                <SelectItem value="en" className="text-white">English</SelectItem>
                <SelectItem value="he" className="text-white">עברית</SelectItem>
                <SelectItem value="es" className="text-white">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-white/50">{t.common.cancel}</Button>
            <Button onClick={handle} disabled={saving}
              className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl">
              {saving ? "…" : ad.saveChanges}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────── User row + kebab ──────────── */
function UserRow({ user, allUsers, onRefresh }: { user: AdminUser; allUsers: AdminUser[]; onRefresh: () => void }) {
  const { t, language } = useI18n();
  const ad = t.admin;
  const dateLocale = DATE_LOCALES[language] ?? enUS;
  const [modal, setModal] = useState<"suspend" | "reactivate" | "soft" | "hard" | "edit" | null>(null);

  const close = () => setModal(null);
  const done = () => { close(); onRefresh(); };

  return (
    <>
      <div className="px-5 py-3 flex items-center gap-3 hover:bg-white/2 transition-colors">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{
            background: user.accountStatus === "deleted" ? "rgba(255,255,255,0.05)" : "rgba(255,107,53,0.15)",
            color: user.accountStatus === "deleted" ? "rgba(255,255,255,0.2)" : "#FF6B35",
          }}>
          {(user.accountStatus === "deleted" ? "?" : user.name.charAt(0)).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate"
              style={{ opacity: user.accountStatus === "deleted" ? 0.4 : 1 }}>
              {user.name}
            </p>
            <StatusBadge status={user.accountStatus} ad={ad} />
            <RoleBadge role={user.role} ad={ad} />
          </div>
          <p className="text-xs text-white/40 truncate">{user.email}</p>
          <p className="text-[10px] text-white/25 ltr-num">
            {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: dateLocale })}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 border-white/10" style={{ background: "var(--surface-elevated)" }}>
            <DropdownMenuItem className="text-white/80 cursor-pointer" onClick={() => setModal("edit")}>
              <Edit3 className="h-3.5 w-3.5 me-2 text-primary" />{ad.edit}
            </DropdownMenuItem>
            {user.accountStatus === "active" && (
              <DropdownMenuItem className="text-yellow-400 cursor-pointer" onClick={() => setModal("suspend")}>
                <UserX className="h-3.5 w-3.5 me-2" />{ad.suspend}
              </DropdownMenuItem>
            )}
            {user.accountStatus === "suspended" && (
              <DropdownMenuItem className="text-green-400 cursor-pointer" onClick={() => setModal("reactivate")}>
                <UserCheck className="h-3.5 w-3.5 me-2" />{ad.reactivate}
              </DropdownMenuItem>
            )}
            {user.accountStatus !== "deleted" && (
              <>
                <DropdownMenuSeparator className="bg-white/8" />
                <DropdownMenuItem className="text-orange-400 cursor-pointer" onClick={() => setModal("soft")}>
                  <Trash2 className="h-3.5 w-3.5 me-2" />{ad.softDelete}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator className="bg-white/8" />
            <DropdownMenuItem className="text-red-400 cursor-pointer" onClick={() => setModal("hard")}>
              <AlertCircle className="h-3.5 w-3.5 me-2" />{ad.hardDelete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {modal === "suspend" && <SuspendModal user={user} open onClose={close} onDone={done} />}
      {modal === "reactivate" && <ReactivateModal user={user} open onClose={close} onDone={done} />}
      {modal === "soft" && <SoftDeleteModal user={user} open onClose={close} onDone={done} allUsers={allUsers} />}
      {modal === "hard" && <HardDeleteModal user={user} open onClose={close} onDone={done} allUsers={allUsers} />}
      {modal === "edit" && <EditUserModal user={user} open onClose={close} onDone={done} />}
    </>
  );
}

/* ──────────── Main page ──────────── */
export default function AdminPage() {
  const { t, language } = useI18n();
  const ad = t.admin;
  const dateLocale = DATE_LOCALES[language] ?? enUS;
  const { theme } = useTheme();
  const isLight = useMemo(() => theme === "light" || (theme === "system" && !window.matchMedia("(prefers-color-scheme: dark)").matches), [theme]);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"kpis" | "users">("kpis");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "deleted">("all");
  const [adminFilter, setAdminFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const debounce = useCallback((val: string) => {
    setSearch(val);
    const t = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(t);
  }, []);

  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery<AdminKpis>({
    queryKey: ["admin", "kpis"],
    queryFn: () => apiFetch("/api/admin/kpis"),
    retry: false,
  });

  const usersParams = new URLSearchParams({
    status: statusFilter,
    ...(adminFilter ? { isAdmin: "true" } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    limit: "100",
  });

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<{
    users: AdminUser[]; total: number; page: number; limit: number;
  }>({
    queryKey: ["admin", "users", statusFilter, adminFilter, debouncedSearch],
    queryFn: () => apiFetch(`/api/admin/users?${usersParams}`),
    enabled: tab === "users",
    retry: false,
  });

  const users = usersData?.users ?? [];

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    refetchUsers();
  }

  if (kpisError && (kpisError as Error).message?.includes("Admin")) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <ShieldCheck className="h-12 w-12 text-red-500 mb-4" />
        <p>{ad.notAdmin}</p>
      </div>
    );
  }

  const kpiCards = kpis ? [
    { label: ad.totalUsers, value: kpis.totalUsers, icon: Users, color: "#4a90e2" },
    { label: ad.activeUsers, value: kpis.activeUsers, icon: Activity, color: "#2ecc71" },
    { label: ad.totalTeams, value: kpis.totalTeams, icon: TrendingUp, color: "#FF6B35" },
    { label: ad.totalEvents, value: kpis.totalEvents, icon: Calendar, color: "#f7b538" },
    { label: ad.totalTasks, value: kpis.totalTasks, icon: CheckSquare, color: "#9b59b6" },
    { label: ad.totalMessages, value: kpis.totalMessages, icon: MessageSquare, color: "#e74c3c" },
  ] : [];

  const TABS = [
    { id: "kpis", label: ad.kpis, icon: BarChart3 },
    { id: "users", label: ad.users, icon: Users },
  ] as const;

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="section-label mb-1">{ad.subtitle.toUpperCase()}</p>
          <h1 className="font-display text-4xl text-white tracking-wide">{ad.title.toUpperCase()}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/invitations">
            <Button variant="ghost" className="text-white/50 hover:text-white border border-white/10 rounded-xl h-9 px-3 text-xs">
              <Mail className="h-3.5 w-3.5 me-1.5" />
              Invitations
            </Button>
          </Link>
          <Link href="/admin/audit-log">
            <Button variant="ghost" className="text-white/50 hover:text-white border border-white/10 rounded-xl h-9 px-3 text-xs">
              <ClipboardList className="h-3.5 w-3.5 me-1.5" />
              {ad.auditLog}
            </Button>
          </Link>
          <ShieldCheck className="h-8 w-8 text-primary opacity-50" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: tab === tb.id ? "rgba(255,107,53,0.2)" : isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
              color: tab === tb.id ? "#FF6B35" : isLight ? "rgba(10,14,26,0.50)" : "rgba(255,255,255,0.4)",
              border: tab === tb.id ? "1px solid rgba(255,107,53,0.4)" : isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
            }}>
            <tb.icon className="h-4 w-4 inline me-2" />{tb.label}
          </button>
        ))}
      </div>

      {/* KPIs tab */}
      {tab === "kpis" && (
        <div className="space-y-6">
          {kpisLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
            </div>
          ) : kpisError ? (
            <div className="flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="h-5 w-5" />{ad.failedLoad}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {kpiCards.map(card => (
                <div key={card.label} className="rounded-2xl p-4 border border-border" style={{ background: "var(--surface-card)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${card.color}20` }}>
                    <card.icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <p className="font-display text-3xl text-white ltr-num">{card.value.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1 font-medium">{card.label}</p>
                </div>
              ))}
            </div>
          )}

          {kpis && (
            <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
              <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="font-semibold text-white text-sm">{ad.recentUsers}</p>
              </div>
              <div className="divide-y divide-white/5">
                {kpis.recentUsers.map(user => (
                  <div key={user.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "rgba(255,107,53,0.15)", color: "#FF6B35" }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                    <StatusBadge status={user.accountStatus} ad={ad} />
                    <RoleBadge role={user.role} ad={ad} />
                    <p className="text-xs text-white/30 shrink-0 ltr-num">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users tab */}
      {tab === "users" && (
        <div className="space-y-4">
          {/* Search + filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <Input value={search} onChange={e => debounce(e.target.value)}
                placeholder={ad.searchUsers}
                className="ps-9 bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "active", "suspended", "deleted"] as const).map(f => {
                const label = f === "all" ? ad.filterAll : f === "active" ? ad.filterActive : f === "suspended" ? ad.filterSuspended : ad.filterDeleted;
                const active = statusFilter === f;
                return (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: active ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.04)",
                      color: active ? "#FF6B35" : "rgba(255,255,255,0.35)",
                      border: active ? "1px solid rgba(255,107,53,0.35)" : "1px solid rgba(255,255,255,0.07)",
                    }}>
                    {label}
                  </button>
                );
              })}
              <button onClick={() => setAdminFilter(!adminFilter)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: adminFilter ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.04)",
                  color: adminFilter ? "#FF6B35" : "rgba(255,255,255,0.35)",
                  border: adminFilter ? "1px solid rgba(255,107,53,0.35)" : "1px solid rgba(255,255,255,0.07)",
                }}>
                <Shield className="h-3 w-3 inline me-1" />{ad.filterAdmins}
              </button>
            </div>
          </div>

          {/* Count */}
          {usersData && (
            <p className="text-xs text-white/30">
              {usersData.total} {usersData.total === 1 ? "user" : "users"}
            </p>
          )}

          <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
            {usersLoading ? (
              <div className="p-4 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="h-10 w-10 mx-auto text-white/15 mb-3" />
                <p className="text-sm text-white/30">No users found</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {users.map(user => (
                  <UserRow key={user.id} user={user} allUsers={users} onRefresh={refreshAll} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
