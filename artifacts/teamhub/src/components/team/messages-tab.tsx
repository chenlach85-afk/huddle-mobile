import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MessageSquare, Pin, Plus, Send, ChevronDown, ChevronUp, Check,
  Smartphone, Mail, MessageCircle, Users, Filter, MoreVertical, Pencil, Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";

type BroadcastMsg = {
  id: number;
  title: string | null;
  messageType: string | null;
  senderName: string;
  targetAudience: string | null;
  channels: { in_app: boolean; email: boolean; whatsapp: boolean } | null;
  content: string;
  pinned: boolean;
  createdAt: string;
  senderUserId: number | null;
};

type DeliverySummary = {
  in_app: { sent: number; failed: number };
  email: { sent: number; failed: number };
  whatsapp_urls: string[];
};

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  announcement: { label: "Announcement", icon: "📢", color: "#3498db" },
  reminder: { label: "Reminder", icon: "📅", color: "#f7b538" },
  urgent: { label: "Urgent", icon: "🔥", color: "#e74c3c" },
  general: { label: "General", icon: "💬", color: "rgba(255,255,255,0.5)" },
};

const DATE_LOCALES = { he, es, en: enUS };

function TypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
        <button key={key} onClick={() => onChange(key)}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold border transition-all"
          style={value === key
            ? { background: `${cfg.color}20`, borderColor: `${cfg.color}50`, color: cfg.color }
            : { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }
          }>
          <span>{cfg.icon}</span> {cfg.label}
        </button>
      ))}
    </div>
  );
}

function DeliveryResultModal({ summary, onClose }: { summary: DeliverySummary; onClose: () => void }) {
  const { t } = useI18n();
  const m = t.messages;
  const [tabsOpened, setTabsOpened] = useState(false);

  function openWhatsappTabs() {
    for (const url of summary.whatsapp_urls) {
      window.open(url, "_blank", "noopener");
    }
    setTabsOpened(true);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm border-border" style={{ background: "hsl(226,40%,8%)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-white tracking-wide flex items-center gap-2">
            <Check className="h-5 w-5 text-green-400" />{m.deliverySummaryTitle.toUpperCase()}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-white/60"><Smartphone className="h-3.5 w-3.5" /> {m.deliveryInApp}</div>
              <span className="text-white font-semibold">{summary.in_app.sent} sent{summary.in_app.failed > 0 ? ` · ${summary.in_app.failed} failed` : ""}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-white/60"><Mail className="h-3.5 w-3.5" /> {m.deliveryEmail}</div>
              <span className="text-white font-semibold">{summary.email.sent} sent{summary.email.failed > 0 ? ` · ${summary.email.failed} failed` : ""}</span>
            </div>
            {summary.whatsapp_urls.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-white/60"><MessageCircle className="h-3.5 w-3.5" /> {m.deliveryWhatsapp}</div>
                <span className="text-white font-semibold">{summary.whatsapp_urls.length} ready</span>
              </div>
            )}
          </div>
          {summary.whatsapp_urls.length > 0 && !tabsOpened && (
            <Button onClick={openWhatsappTabs} className="w-full rounded-xl font-semibold" style={{ background: "#25D366", color: "white" }}>
              <MessageCircle className="h-4 w-4 me-2" />
              {m.openWhatsappTabs} ({summary.whatsapp_urls.length})
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="w-full border border-white/15 text-white/60 rounded-xl">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComposeDialog({ open, onClose, teamId, teamColor, onSent }: {
  open: boolean; onClose: () => void; teamId: number; teamColor: string; onSent: () => void;
}) {
  const { t } = useI18n();
  const m = t.messages;
  const { toast } = useToast();
  const [msgType, setMsgType] = useState("announcement");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("all");
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [channelWhatsapp, setChannelWhatsapp] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);

  async function handleSend() {
    if (!title.trim() || !content.trim()) { toast({ title: "Headline and message required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), content: content.trim(),
          messageType: msgType, targetAudience: audience,
          channels: { in_app: channelInApp, email: channelEmail, whatsapp: channelWhatsapp },
          pinned,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onSent();
      onClose();
      setDeliverySummary(data.deliverySummary);
      setTitle(""); setContent(""); setMsgType("announcement"); setAudience("all");
      setChannelInApp(true); setChannelEmail(false); setChannelWhatsapp(false); setPinned(false);
    } catch {
      toast({ title: m.failedSend ?? "Failed to send", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ background: "hsl(226,40%,8%)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">{m.newBroadcast.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pb-2">
            <div>
              <p className="stat-label text-white/50 mb-2">{m.broadcastType}</p>
              <TypePicker value={msgType} onChange={setMsgType} />
            </div>
            <div>
              <label className="stat-label text-white/60 block mb-1.5">{m.headline} *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={m.headlineHelp}
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl" />
            </div>
            <div>
              <label className="stat-label text-white/60 block mb-1.5">{m.messageBody} *</label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl text-sm resize-none" />
            </div>
            <div>
              <p className="stat-label text-white/50 mb-2">{m.audience}</p>
              <div className="space-y-1.5">
                {[
                  { v: "all", label: m.audienceAll },
                  { v: "players_only", label: m.audiencePlayers },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setAudience(opt.v)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm border transition-all"
                    style={audience === opt.v
                      ? { background: `${teamColor}18`, borderColor: `${teamColor}40`, color: "white" }
                      : { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.65)" }
                    }>
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${audience === opt.v ? "border-orange-400" : "border-white/30"}`}>
                      {audience === opt.v && <span className="w-1.5 h-1.5 rounded-full" style={{ background: teamColor }} />}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="stat-label text-white/50 mb-2">{m.channels}</p>
              <div className="space-y-2">
                {[
                  { key: "in_app", label: m.channelInApp, val: channelInApp, set: setChannelInApp, icon: <Smartphone className="h-3.5 w-3.5" />, color: "#3498db", locked: true },
                  { key: "email", label: m.channelEmail, val: channelEmail, set: setChannelEmail, icon: <Mail className="h-3.5 w-3.5" />, color: "#2ecc71" },
                  { key: "whatsapp", label: m.channelWhatsapp, val: channelWhatsapp, set: setChannelWhatsapp, icon: <MessageCircle className="h-3.5 w-3.5" />, color: "#25D366" },
                ].map(ch => (
                  <button key={ch.key} onClick={() => !ch.locked && ch.set(!ch.val)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm border transition-all"
                    style={ch.val
                      ? { background: `${ch.color}15`, borderColor: `${ch.color}40`, color: "white" }
                      : { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }
                    }>
                    <span style={{ color: ch.val ? ch.color : "rgba(255,255,255,0.35)" }}>{ch.icon}</span>
                    <span className="flex-1 text-start">{ch.label}</span>
                    <span className={`w-4 h-4 rounded flex items-center justify-center border ${ch.val ? "border-transparent" : "border-white/25"}`}
                      style={ch.val ? { background: ch.color } : {}}>
                      {ch.val && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} className="flex-1 border border-white/15 text-white/60 rounded-xl">{t.common.cancel}</Button>
              <Button onClick={handleSend} disabled={loading} className="flex-1 font-semibold rounded-xl"
                style={{ background: teamColor, color: "white" }}>
                <Send className="h-3.5 w-3.5 me-2" />
                {loading ? "Sending…" : m.sendBroadcast}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {deliverySummary && <DeliveryResultModal summary={deliverySummary} onClose={() => setDeliverySummary(null)} />}
    </>
  );
}

function MessageCard({ msg, teamColor, canEdit, onDeleted, onEdited }: {
  msg: BroadcastMsg; teamColor: string;
  canEdit: boolean;
  onDeleted: () => void;
  onEdited: () => void;
}) {
  const { language } = useI18n();
  const { toast } = useToast();
  const cfg = TYPE_CONFIG[msg.messageType ?? "general"] ?? TYPE_CONFIG.general;
  const dateLocale = DATE_LOCALES[language as keyof typeof DATE_LOCALES] ?? enUS;
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(msg.title ?? "");
  const [editContent, setEditContent] = useState(msg.content);
  const [editLoading, setEditLoading] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const isLong = msg.content.length > 200;

  async function handleSaveEdit() {
    if (!editTitle.trim() || !editContent.trim()) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/messages/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
      });
      if (!res.ok) throw new Error();
      onEdited();
      setEditOpen(false);
    } catch {
      toast({ title: "Failed to update message", variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    setDelLoading(true);
    try {
      const res = await fetch(`/api/messages/${msg.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted();
    } catch {
      toast({ title: "Failed to delete message", variant: "destructive" });
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-2.5"
      style={{
        background: msg.pinned ? `${teamColor}0d` : "hsl(226,40%,10%)",
        border: msg.pinned ? `1px solid ${teamColor}25` : "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${cfg.color}50`,
      }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${cfg.color}20`, color: cfg.color }}>
            {cfg.icon} {cfg.label}
          </span>
          {msg.pinned && <Pin className="h-3 w-3" style={{ color: teamColor }} />}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-white/25 ltr-num">
            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: dateLocale })}
          </span>
          {canEdit && (
            <div className="relative">
              <button onClick={() => setMenuOpen(p => !p)}
                className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-colors">
                <MoreVertical className="h-3.5 w-3.5 text-white/30" />
              </button>
              {menuOpen && (
                <div className="absolute end-0 top-7 z-10 rounded-xl border border-white/15 py-1 min-w-[120px]"
                  style={{ background: "hsl(226,40%,14%)" }}>
                  <button onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/8 transition-colors">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button onClick={() => { setMenuOpen(false); handleDelete(); }}
                    disabled={delLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-3 w-3" /> {delLoading ? "Deleting…" : "Delete"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {msg.title && <p className="font-semibold text-white text-sm">{msg.title}</p>}
      <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
        {!expanded && isLong ? `${msg.content.slice(0, 200)}…` : msg.content}
      </p>
      {isLong && (
        <button onClick={() => setExpanded(p => !p)} className="text-xs flex items-center gap-1" style={{ color: teamColor }}>
          {expanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Read more</>}
        </button>
      )}
      <div className="flex items-center gap-1 pt-0.5">
        <span className="text-[10px] text-white/30">{msg.senderName}</span>
        {msg.channels?.email && <Mail className="h-2.5 w-2.5 text-white/20" />}
        {msg.channels?.whatsapp && <MessageCircle className="h-2.5 w-2.5 text-white/20" />}
      </div>

      {/* Inline edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md border-border" style={{ background: "hsl(226,40%,8%)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-white tracking-wide">EDIT MESSAGE</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="stat-label text-white/60 block mb-1.5">Headline</label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl" />
            </div>
            <div>
              <label className="stat-label text-white/60 block mb-1.5">Message</label>
              <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30 rounded-xl text-sm resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditOpen(false)} className="flex-1 border border-white/15 text-white/60 rounded-xl">Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={editLoading} className="flex-1 font-semibold rounded-xl"
                style={{ background: teamColor, color: "white" }}>
                {editLoading ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MessagesTab({
  teamId, teamColor, isCoach, currentUserId,
}: { teamId: number; teamColor: string; isCoach: boolean; currentUserId?: number }) {
  const { t } = useI18n();
  const m = t.messages;
  const [messages, setMessages] = useState<BroadcastMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "week">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/announcements`);
      if (res.ok) setMessages(await res.json());
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const filtered = messages.filter(msg => {
    if (filter === "today") return new Date(msg.createdAt).toDateString() === new Date().toDateString();
    if (filter === "week") return now - new Date(msg.createdAt).getTime() < 7 * 86400000;
    return true;
  });

  const pinned = filtered.filter(m => m.pinned);
  const regular = filtered.filter(m => !m.pinned);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["all", "today", "week"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={filter === f
                ? { background: `${teamColor}25`, color: teamColor }
                : { color: "rgba(255,255,255,0.35)" }
              }>
              {f === "all" ? m.filterAll : f === "today" ? m.filterToday : m.filterWeek}
            </button>
          ))}
        </div>
        {isCoach && (
          <Button size="sm" onClick={() => setComposeOpen(true)} className="rounded-xl font-semibold"
            style={{ background: teamColor, color: "white" }}>
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {m.newBroadcast}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 p-10 text-center" style={{ background: "hsl(226,40%,10%)" }}>
          <MessageSquare className="h-10 w-10 mx-auto text-white/15 mb-3" />
          <p className="font-display text-xl text-white/30 tracking-wide">{m.huddleIsQuiet?.toUpperCase() ?? "QUIET"}</p>
          <p className="text-xs text-white/25 mt-1">{isCoach ? m.sendFirst : "No messages yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <>
              <p className="section-label flex items-center gap-1.5 px-1"><Pin className="h-2.5 w-2.5" />{m.pinned}</p>
              {pinned.map(msg => (
                <MessageCard key={msg.id} msg={msg} teamColor={teamColor}
                  canEdit={isCoach || msg.senderUserId === currentUserId}
                  onDeleted={load} onEdited={load} />
              ))}
              {regular.length > 0 && <p className="section-label px-1 pt-1">{m.allMessages}</p>}
            </>
          )}
          {regular.map(msg => (
            <MessageCard key={msg.id} msg={msg} teamColor={teamColor}
              canEdit={isCoach || msg.senderUserId === currentUserId}
              onDeleted={load} onEdited={load} />
          ))}
        </div>
      )}

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)}
        teamId={teamId} teamColor={teamColor} onSent={load} />
    </div>
  );
}
