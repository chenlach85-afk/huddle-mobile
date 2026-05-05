import { useState } from "react";
import {
  useListPlayers,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, Trash2, Pencil, Mail, Link2, Copy, Check, Send, RotateCcw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const STATUS_COLORS: Record<string, string> = {
  active: "#2ecc71",
  inactive: "rgba(255,255,255,0.3)",
  injured: "#e74c3c",
};

const playerSchema = z.object({
  name: z.string().min(1),
  number: z.string().optional(),
  position: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive", "injured"]).default("active"),
  notes: z.string().optional(),
});
type PlayerForm = z.infer<typeof playerSchema>;

type ActiveInvite = {
  id: number;
  token: string;
  inviteType: string;
  email: string | null;
  status: string;
  url: string;
  expiresAt: string;
  createdAt: string;
};

/* ─── Invite Player Modal ─────────────────────────────────────── */

function InvitePlayerModal({ teamId, teamColor, open, onClose }: {
  teamId: number;
  teamColor: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ti = t.teamInvite;
  const { toast } = useToast();

  const [tab, setTab] = useState<"email" | "link">("email");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeInvites, setActiveInvites] = useState<ActiveInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [resending, setResending] = useState<number | null>(null);

  async function loadInvites() {
    setInvitesLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`);
      if (res.ok) {
        const data = await res.json();
        setActiveInvites(data.filter((i: ActiveInvite) => i.status === "pending"));
      }
    } finally {
      setInvitesLoading(false);
    }
  }

  function handleOpen() {
    loadInvites();
  }

  async function sendEmailInvite() {
    if (!email || !email.includes("@")) return;
    setEmailStatus("sending");
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", email }),
      });
      if (res.ok) {
        setEmailStatus("sent");
        setEmail("");
        loadInvites();
      } else {
        setEmailStatus("error");
      }
    } catch {
      setEmailStatus("error");
    }
  }

  async function generateLink() {
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "link" }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinkUrl(data.url);
        loadInvites();
      }
    } finally {
      setLinkLoading(false);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revokeInvite(invId: number) {
    setRevoking(invId);
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations/${invId}/revoke`, { method: "POST" });
      if (res.ok) {
        toast({ title: ti.inviteRevoked });
        loadInvites();
        if (linkUrl) setLinkUrl(null);
      }
    } finally {
      setRevoking(null);
    }
  }

  async function resendInvite(invId: number) {
    setResending(invId);
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations/${invId}/resend`, { method: "POST" });
      if (res.ok) {
        toast({ title: ti.inviteResent });
      }
    } finally {
      setResending(null);
    }
  }

  function handleClose() {
    setEmail("");
    setEmailStatus("idle");
    setLinkUrl(null);
    setCopied(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else handleOpen(); }}>
      <DialogContent className="max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white tracking-wide">
            {ti.invitePlayer.toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-xl overflow-hidden border border-white/8" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["email", "link"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setEmailStatus("idle"); }}
              className="flex-1 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              style={{
                background: tab === t ? teamColor : "transparent",
                color: tab === t ? "white" : "rgba(255,255,255,0.4)",
              }}>
              {t === "email" ? <Mail className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
              {t === "email" ? ti.emailTab : ti.linkTab}
            </button>
          ))}
        </div>

        {/* Email tab */}
        {tab === "email" && (
          <div className="space-y-3">
            <p className="text-xs text-white/40">{ti.emailInviteLabel}</p>
            {emailStatus === "sent" ? (
              <div className="rounded-xl p-4 text-center space-y-1.5"
                style={{ background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)" }}>
                <Check className="h-6 w-6 text-green-400 mx-auto" />
                <p className="text-sm font-semibold text-green-400">{ti.inviteSent}</p>
                <p className="text-xs text-white/40">{ti.inviteSentDesc}</p>
                <Button variant="ghost" size="sm" onClick={() => setEmailStatus("idle")}
                  className="text-white/50 text-xs mt-1">
                  Send another
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="stat-label text-white/50 block mb-1.5">{ti.playerEmail}</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailStatus("idle"); }}
                    placeholder={ti.emailPlaceholder}
                    className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                    onKeyDown={e => { if (e.key === "Enter") sendEmailInvite(); }}
                  />
                </div>
                {emailStatus === "error" && (
                  <p className="text-xs text-red-400">{ti.inviteError}</p>
                )}
                <Button
                  onClick={sendEmailInvite}
                  disabled={emailStatus === "sending" || !email || !email.includes("@")}
                  className="w-full font-semibold rounded-xl h-10"
                  style={{ background: teamColor, color: "white" }}>
                  {emailStatus === "sending" ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      {ti.sending}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-3.5 w-3.5" />
                      {ti.sendInvite}
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Link tab */}
        {tab === "link" && (
          <div className="space-y-3">
            <p className="text-xs text-white/40">{ti.linkInviteLabel}</p>
            {linkUrl ? (
              <div className="space-y-2">
                <div className="rounded-xl p-3 flex items-center gap-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs text-white/60 font-mono flex-1 truncate">{linkUrl}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => copyLink(linkUrl)}>
                    {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-white/50" />}
                  </Button>
                </div>
                <Button onClick={() => copyLink(linkUrl)}
                  className="w-full font-semibold rounded-xl h-10"
                  style={{ background: copied ? "#2ecc71" : teamColor, color: "white" }}>
                  {copied ? (
                    <span className="flex items-center gap-2"><Check className="h-3.5 w-3.5" />{ti.linkCopied}</span>
                  ) : (
                    <span className="flex items-center gap-2"><Copy className="h-3.5 w-3.5" />{ti.copyLink}</span>
                  )}
                </Button>
                <p className="text-[10px] text-white/25 text-center">{ti.linkDesc}</p>
              </div>
            ) : (
              <Button
                onClick={generateLink}
                disabled={linkLoading}
                className="w-full font-semibold rounded-xl h-10"
                style={{ background: teamColor, color: "white" }}>
                {linkLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    {ti.sending}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5" />
                    {ti.generateLink}
                  </span>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Active invitations list */}
        {activeInvites.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/6">
            <p className="stat-label text-white/40">{ti.activeInvites}</p>
            {invitesLoading ? (
              <Skeleton className="h-10 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
            ) : (
              <div className="space-y-1.5">
                {activeInvites.map(inv => (
                  <div key={inv.id} className="rounded-xl px-3 py-2 flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {inv.inviteType === "email" ? (
                          <Mail className="h-3 w-3 text-white/30 shrink-0" />
                        ) : (
                          <Link2 className="h-3 w-3 text-white/30 shrink-0" />
                        )}
                        <p className="text-xs text-white/60 truncate">
                          {inv.email ?? ti.linkTab}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {inv.inviteType === "email" && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/30 hover:text-white/60"
                          disabled={resending === inv.id}
                          onClick={() => resendInvite(inv.id)}
                          title={ti.resend}>
                          {resending === inv.id
                            ? <span className="w-3 h-3 rounded-full border border-white/40 border-t-transparent animate-spin" />
                            : <RotateCcw className="h-3 w-3" />}
                        </Button>
                      )}
                      {inv.inviteType === "link" && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-white/30 hover:text-white/60"
                          onClick={() => copyLink(inv.url)}
                          title={ti.copyLink}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400/50 hover:text-red-400"
                        disabled={revoking === inv.id}
                        onClick={() => revokeInvite(inv.id)}
                        title={ti.revoke}>
                        {revoking === inv.id
                          ? <span className="w-3 h-3 rounded-full border border-red-400/40 border-t-transparent animate-spin" />
                          : <X className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main component ──────────────────────────────────────────── */

export default function PlayersTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const p = t.players;
  const ti = t.teamInvite;

  const { data: players = [], isLoading } = useListPlayers(teamId, {
    query: { enabled: !!teamId, queryKey: getListPlayersQueryKey(teamId) },
  });
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();

  const form = useForm<PlayerForm>({
    resolver: zodResolver(playerSchema),
    defaultValues: { name: "", number: "", position: "", email: "", phone: "", status: "active", notes: "" },
  });

  function openCreate() { form.reset(); setEditingId(null); setOpen(true); }
  function openEdit(player: typeof players[0]) {
    form.reset({ name: player.name, number: player.number?.toString() || "", position: player.position || "", email: player.email || "", phone: player.phone || "", status: player.status, notes: player.notes || "" });
    setEditingId(player.id);
    setOpen(true);
  }

  function onSubmit(values: PlayerForm) {
    const payload = {
      name: values.name,
      number: values.number ? parseInt(values.number) : null,
      position: values.position || null,
      email: values.email || null,
      phone: values.phone || null,
      status: values.status,
      notes: values.notes || null,
    };
    if (editingId) {
      updatePlayer.mutate({ playerId: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) }); setOpen(false); toast({ title: p.playerUpdated }); },
        onError: () => toast({ title: p.failedUpdate, variant: "destructive" }),
      });
    } else {
      createPlayer.mutate({ teamId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) }); setOpen(false); toast({ title: p.playerAdded }); },
        onError: () => toast({ title: p.failedAdd, variant: "destructive" }),
      });
    }
  }

  function handleDelete(playerId: number) {
    if (!confirm(p.confirmRemove)) return;
    deletePlayer.mutate({ playerId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) }); toast({ title: p.playerRemoved }); },
      onError: () => toast({ title: p.failedRemove, variant: "destructive" }),
    });
  }

  const statusLabel = (s: string) => {
    if (s === "active") return p.statusActive;
    if (s === "inactive") return p.statusInactive;
    return p.statusInjured;
  };

  const isPending = createPlayer.isPending || updatePlayer.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-label"><span className="ltr-num">{players.length}</span> {p.athletesOnSquad}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setInviteOpen(true)}
            className="font-semibold rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20"
            data-testid="button-invite-player">
            <Mail className="h-3.5 w-3.5 me-1.5" />
            {ti.invitePlayer}
          </Button>
          <Button size="sm" onClick={openCreate} className="font-semibold rounded-xl" style={{ background: teamColor, color: "white" }} data-testid="button-add-player">
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {p.addAthlete}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}</div>
      ) : players.length === 0 ? (
        <div className="rounded-2xl border border-border p-10 text-center" style={{ background: "var(--surface-card)" }}>
          <Users className="h-10 w-10 mx-auto text-white/15 mb-3" />
          <p className="font-display text-xl text-white/30 tracking-wide">{p.emptySquad.toUpperCase()}</p>
          <p className="text-xs text-white/25 mt-1 mb-4">{p.addToGetStarted}</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="ghost" onClick={() => setInviteOpen(true)}
              className="rounded-xl font-semibold border border-white/10 text-white/50">
              <Mail className="h-3.5 w-3.5 me-1" />
              {ti.invitePlayer}
            </Button>
            <Button size="sm" onClick={openCreate} style={{ background: teamColor, color: "white" }} className="rounded-xl font-semibold">{p.addAthlete}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map(player => {
            const color = STATUS_COLORS[player.status];
            return (
              <div key={player.id} className="rounded-2xl border border-border p-4 flex items-center gap-4 group hover:bg-white/3 transition-all" style={{ background: "var(--surface-card)" }} data-testid={`card-player-${player.id}`}>
                <div className="jersey-tile text-lg relative" style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}88)` }}>
                  <span className="ltr-num">{player.number ?? player.name.charAt(0).toUpperCase()}</span>
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-card" style={{ background: color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm" data-testid={`text-player-name-${player.id}`}>{player.name}</span>
                    {player.position && <span className="text-xs text-white/40">{player.position}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{statusLabel(player.status)}</span>
                    {(player.email || player.phone) && (
                      <span className="text-[10px] text-white/25">{player.email || player.phone}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/8" onClick={() => openEdit(player)} data-testid={`button-edit-player-${player.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400/60 hover:text-red-400 hover:bg-red-400/10" onClick={() => handleDelete(player.id)} data-testid={`button-delete-player-${player.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Player modal */}
      <InvitePlayerModal
        teamId={teamId}
        teamColor={teamColor}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />

      {/* Add / Edit player dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-border" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">
              {editingId ? p.editAthlete.toUpperCase() : p.addAthlete.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{p.fullName}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="number" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{p.jerseyNumber}</FormLabel>
                    <FormControl><Input type="number" placeholder="00" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl font-display text-xl ltr-num" data-testid="input-jersey-number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{p.position}</FormLabel>
                    <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-position" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{p.statusLabel}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-player-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                      <SelectItem value="active" className="text-white">{p.statusActive}</SelectItem>
                      <SelectItem value="inactive" className="text-white">{p.statusInactive}</SelectItem>
                      <SelectItem value="injured" className="text-white">{p.statusInjured}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{p.email} ({t.common.optional})</FormLabel>
                  <FormControl><Input type="email" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{p.phone} ({t.common.optional})</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-phone" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{p.notes} ({t.common.optional})</FormLabel>
                  <FormControl><Textarea className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full font-semibold rounded-xl h-11" style={{ background: teamColor, color: "white" }} disabled={isPending} data-testid="button-submit-player">
                {isPending ? t.common.saving : editingId ? p.updateAthlete : p.addToSquad}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
