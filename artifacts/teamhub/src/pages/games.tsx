import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Trophy, MapPin, Clock, Calendar, Users, MessageCircle, Pencil, ArrowRight,
  Plus, Home, Plane, Shirt, Package, Trash2, Edit3, Eye, MoreHorizontal,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow, format, isPast } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const GAME_TYPES = ["league_game", "friendly_game", "tournament"] as const;
type GameType = typeof GAME_TYPES[number];

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  league_game: { label: "League Game", color: "#f7b538", icon: "🏆" },
  friendly_game: { label: "Friendly", color: "#3498db", icon: "🤝" },
  tournament: { label: "Tournament", color: "#9b59b6", icon: "🥇" },
};

type EventRow = {
  id: number; title: string; type: string; location: string | null;
  startsAt: string; endsAt: string | null; notes: string | null;
  opponent: string | null; isHome: boolean | null; arrivalTime: string | null;
  uniformColor: string | null; uniformSecondaryColor: string | null;
  uniformNotes: string | null; whatToBring: string | null;
  homeScore: number | null; awayScore: number | null;
  attendingCount: number; totalCount: number;
};

function Countdown({ target }: { target: Date }) {
  const [diff, setDiff] = useState(target.getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setDiff(target.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");
  return (
    <div className="flex items-end justify-center gap-3">
      {[{ v: d, u: "d" }, { v: h, u: "h" }, { v: m, u: "m" }, { v: s, u: "s" }].map(({ v, u }) => (
        <div key={u} className="flex flex-col items-center">
          <span className="font-display text-3xl text-white leading-none ltr-num">{pad(v)}</span>
          <span className="text-[9px] uppercase tracking-widest text-white/30 mt-1">{u}</span>
        </div>
      ))}
    </div>
  );
}

function formatDateTime(dt: string | null | undefined) {
  if (!dt) return "";
  try { return format(new Date(dt), "EEE, MMM d · HH:mm"); } catch { return ""; }
}

function HeroCard({ event, teamColor, onEdit, isCoach }: { event: EventRow; teamColor: string; onEdit: () => void; isCoach: boolean }) {
  const { t } = useI18n();
  const ng = t.nextGame;
  const cfg = TYPE_CONFIG[event.type] ?? { label: event.type, color: teamColor, icon: "🏟️" };
  const startsAt = new Date(event.startsAt);
  const gameIsPast = isPast(startsAt);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: `linear-gradient(160deg, ${cfg.color}15 0%, rgba(0,0,0,0) 60%), var(--surface-card)` }}>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{cfg.icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        {isCoach && (
          <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
            <Pencil className="h-3.5 w-3.5 text-white/40" />
          </button>
        )}
      </div>
      <div className="px-5 py-4 space-y-4">
        <div>
          <h2 className="font-display text-2xl text-white tracking-wide leading-tight">{event.title.toUpperCase()}</h2>
          {event.opponent && (
            <div className="flex items-center gap-2 mt-2">
              {event.isHome === true && <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: "#2ecc7118", color: "#2ecc71", border: "1px solid #2ecc7130" }}><Home className="h-2.5 w-2.5" /> {t.events.home}</span>}
              {event.isHome === false && <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: "#3498db18", color: "#3498db", border: "1px solid #3498db30" }}><Plane className="h-2.5 w-2.5" /> {t.events.away}</span>}
              <span className="text-sm text-white/60">vs <span className="text-white font-semibold">{event.opponent}</span></span>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.color }} />
            <span className="text-sm text-white/80 font-semibold">{formatDateTime(event.startsAt)}</span>
          </div>
          {event.arrivalTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#f7b538" }} />
              <span className="text-xs text-white/60">{t.events.arrivalTime}: <span className="font-semibold text-white/80">{formatDateTime(event.arrivalTime)}</span></span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.color }} />
              <span className="text-sm text-white/60">{event.location}</span>
            </div>
          )}
        </div>
        {(event.uniformColor || event.uniformNotes || event.whatToBring) && (
          <div className="space-y-1.5">
            {(event.uniformColor || event.uniformNotes) && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Shirt className="h-3.5 w-3.5 shrink-0 text-white/40" />
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  {event.uniformColor && <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ background: event.uniformColor }} />}
                  {event.uniformSecondaryColor && <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ background: event.uniformSecondaryColor }} />}
                  {event.uniformNotes && <span className="text-xs text-white/60">{event.uniformNotes}</span>}
                </div>
              </div>
            )}
            {event.whatToBring && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Package className="h-3.5 w-3.5 shrink-0 text-white/40 mt-0.5" />
                <span className="text-xs text-white/60">{event.whatToBring}</span>
              </div>
            )}
          </div>
        )}
        {gameIsPast && event.homeScore != null && event.awayScore != null && (
          <div className="rounded-xl py-4 text-center" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-2">Final Score</p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="font-display text-4xl text-white ltr-num leading-none">{event.isHome ? event.homeScore : event.awayScore}</p>
                <p className="text-[9px] text-white/40 mt-1 uppercase tracking-wider">Us</p>
              </div>
              <p className="text-2xl text-white/20 font-bold">:</p>
              <div className="text-center">
                <p className="font-display text-4xl text-white/60 ltr-num leading-none">{event.isHome ? event.awayScore : event.homeScore}</p>
                <p className="text-[9px] text-white/40 mt-1 uppercase tracking-wider">{event.opponent ?? "Opponent"}</p>
              </div>
            </div>
            {(() => {
              const ourScore = event.isHome ? event.homeScore : event.awayScore;
              const theirScore = event.isHome ? event.awayScore : event.homeScore;
              if (ourScore == null || theirScore == null) return null;
              const result = ourScore > theirScore ? "WIN" : ourScore < theirScore ? "LOSS" : "DRAW";
              const color = result === "WIN" ? "#2ecc71" : result === "LOSS" ? "#e74c3c" : "#f7b538";
              return <p className="text-[10px] font-bold mt-2 tracking-widest" style={{ color }}>{result}</p>;
            })()}
          </div>
        )}
        {!gameIsPast && (
          <div className="rounded-xl py-4" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-center text-[9px] uppercase tracking-widest text-white/30 mb-3">{ng.countdown}</p>
            <Countdown target={startsAt} />
          </div>
        )}
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">{ng.squadStatus}</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: ng.confirmed, count: event.attendingCount, color: "#2ecc71" },
              { label: ng.maybe, count: 0, color: "#f7b538" },
              { label: ng.cantMake, count: 0, color: "#e74c3c" },
              { label: ng.noResponse, count: Math.max(0, event.totalCount - event.attendingCount), color: "rgba(255,255,255,0.2)" },
            ].map(item => (
              <div key={item.label} className="text-center">
                <p className="text-lg font-bold text-white ltr-num">{item.count}</p>
                <p className="text-[9px] text-white/40 leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameCard({ event, teamColor, isCoach, onEdit, onDelete, onView }: {
  event: EventRow; teamColor: string; isCoach: boolean;
  onEdit: () => void; onDelete: () => void; onView: () => void;
}) {
  const cfg = TYPE_CONFIG[event.type] ?? { label: event.type, color: teamColor, icon: "🏟️" };
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 p-4" style={{ background: "hsl(226,40%,10%)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">{cfg.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
            {event.isHome === true && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#2ecc7115", color: "#2ecc71" }}><Home className="h-2 w-2 inline me-0.5" />Home</span>}
            {event.isHome === false && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#3498db15", color: "#3498db" }}><Plane className="h-2 w-2 inline me-0.5" />Away</span>}
          </div>
          <p className="font-semibold text-white text-sm truncate">
            {event.opponent ? `vs ${event.opponent}` : event.title}
          </p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-white/50 flex items-center gap-1">
              <Calendar className="h-3 w-3" />{formatDateTime(event.startsAt)}
            </span>
            {event.location && (
              <span className="text-xs text-white/40 flex items-center gap-1 truncate max-w-[140px]">
                <MapPin className="h-3 w-3 shrink-0" />{event.location}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-white/25" />
              <span className="text-[10px] text-white/40">
                {event.attendingCount} confirmed · {Math.max(0, event.totalCount - event.attendingCount)} pending
              </span>
            </span>
            {event.homeScore != null && event.awayScore != null && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded ltr-num" style={{
                background: "rgba(255,255,255,0.06)",
                color: (() => {
                  const ours = event.isHome ? event.homeScore : event.awayScore;
                  const theirs = event.isHome ? event.awayScore : event.homeScore;
                  return ours != null && theirs != null && ours > theirs ? "#2ecc71" : ours != null && theirs != null && ours < theirs ? "#e74c3c" : "#f7b538";
                })(),
              }}>
                {event.homeScore}–{event.awayScore}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {isCoach && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white" onClick={onEdit}>
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/40 hover:text-red-400" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GameForm({
  open, onClose, teamId, teamColor, initial, onSaved,
}: {
  open: boolean; onClose: () => void; teamId: number; teamColor: string;
  initial?: Partial<EventRow>; onSaved: () => void;
}) {
  const { t } = useI18n();
  const g = t.games;
  const ev = t.events;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<GameType>(initial?.type as GameType ?? "league_game");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [opponent, setOpponent] = useState(initial?.opponent ?? "");
  const [isHome, setIsHome] = useState<boolean | null>(initial?.isHome ?? null);
  const [date, setDate] = useState(initial?.startsAt ? initial.startsAt.slice(0, 10) : "");
  const [startTime, setStartTime] = useState(initial?.startsAt ? initial.startsAt.slice(11, 16) : "");
  const [endTime, setEndTime] = useState(initial?.endsAt ? initial.endsAt.slice(11, 16) : "");
  const [arrivalTime, setArrivalTime] = useState(initial?.arrivalTime ? initial.arrivalTime.slice(11, 16) : "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [uniformColor, setUniformColor] = useState(initial?.uniformColor ?? "#FF6B35");
  const [uniformSecondaryColor, setUniformSecondaryColor] = useState(initial?.uniformSecondaryColor ?? "");
  const [uniformNotes, setUniformNotes] = useState(initial?.uniformNotes ?? "");
  const [whatToBring, setWhatToBring] = useState(initial?.whatToBring ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [homeScore, setHomeScore] = useState<string>(initial?.homeScore != null ? String(initial.homeScore) : "");
  const [awayScore, setAwayScore] = useState<string>(initial?.awayScore != null ? String(initial.awayScore) : "");
  const [showUniform, setShowUniform] = useState(!!(initial?.uniformColor || initial?.uniformNotes));

  useEffect(() => {
    if (!initial && opponent && date && startTime && isHome !== null) {
      setTitle(`${opponent} — ${isHome ? "Home" : "Away"}`);
    }
  }, [opponent, isHome, initial]);

  async function handleSave() {
    if (!opponent.trim()) { toast({ title: "Opponent required", variant: "destructive" }); return; }
    if (!date || !startTime) { toast({ title: "Date and time required", variant: "destructive" }); return; }
    if (isHome === null) { toast({ title: "Home or Away required", variant: "destructive" }); return; }

    setLoading(true);
    const startsAt = `${date}T${startTime}:00`;
    const endsAt = endTime ? `${date}T${endTime}:00` : null;
    const arrivalDateTime = arrivalTime ? `${date}T${arrivalTime}:00` : null;
    const body = {
      title: title || `vs ${opponent.trim()}`,
      type, opponent: opponent.trim(), isHome, location: location || null,
      startsAt, endsAt, arrivalTime: arrivalDateTime,
      uniformColor: showUniform ? uniformColor : null,
      uniformSecondaryColor: showUniform && uniformSecondaryColor ? uniformSecondaryColor : null,
      uniformNotes: showUniform && uniformNotes ? uniformNotes : null,
      whatToBring: whatToBring || null,
      notes: notes || null,
      homeScore: homeScore !== "" ? parseInt(homeScore) : null,
      awayScore: awayScore !== "" ? parseInt(awayScore) : null,
    };

    try {
      const url = initial?.id ? `/api/events/${initial.id}` : `/api/teams/${teamId}/events`;
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      onSaved();
      onClose();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ background: "hsl(226,40%,8%)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white tracking-wide">
            {(initial?.id ? g.editGame : g.scheduleGameTitle).toUpperCase()}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pb-2">
          {/* Game type */}
          <div>
            <p className="stat-label text-white/40 mb-2">{g.gameType}</p>
            <div className="grid grid-cols-3 gap-2">
              {GAME_TYPES.map(gt => {
                const cfg = TYPE_CONFIG[gt];
                const active = type === gt;
                return (
                  <button key={gt} onClick={() => setType(gt)}
                    className="rounded-xl px-2 py-3 text-center text-xs font-semibold border transition-all"
                    style={active
                      ? { background: `${cfg.color}20`, borderColor: `${cfg.color}50`, color: cfg.color }
                      : { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }
                    }>
                    <div className="text-base mb-1">{cfg.icon}</div>
                    {gt === "league_game" ? g.leagueGame : gt === "friendly_game" ? g.friendlyGame : g.tournamentGame}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opponent */}
          <div>
            <label className="stat-label text-white/40 block mb-1.5">{ev.opponent} *</label>
            <Input value={opponent} onChange={e => setOpponent(e.target.value)}
              placeholder="Riverside United" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
          </div>

          {/* Title */}
          <div>
            <label className="stat-label text-white/40 block mb-1.5">{ev.title}</label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Game vs Riverside" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
          </div>

          {/* Home/Away */}
          <div>
            <p className="stat-label text-white/40 mb-2">{ev.homeOrAway} *</p>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: true, label: ev.home, icon: <Home className="h-3.5 w-3.5" />, color: "#2ecc71" },
                { v: false, label: ev.away, icon: <Plane className="h-3.5 w-3.5" />, color: "#3498db" }].map(opt => (
                <button key={String(opt.v)} onClick={() => setIsHome(opt.v)}
                  className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border transition-all"
                  style={isHome === opt.v
                    ? { background: `${opt.color}20`, borderColor: `${opt.color}50`, color: opt.color }
                    : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                  }>
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date / Times */}
          <div>
            <p className="stat-label text-white/40 mb-2">Date & Time *</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-white/6 border-white/10 text-white rounded-xl" /></div>
              <div>
                <label className="text-[10px] text-white/30 block mb-1">Kickoff *</label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-white/6 border-white/10 text-white rounded-xl" />
              </div>
              <div>
                <label className="text-[10px] text-white/30 block mb-1">{ev.arrivalTime ?? "Arrival"} (optional)</label>
                <Input type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="bg-white/6 border-white/10 text-white rounded-xl" />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="stat-label text-white/40 block mb-1.5">{ev.location}</label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Field 3, Sports Complex"
              className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
          </div>

          {/* Uniform toggle */}
          <div>
            <button onClick={() => setShowUniform(p => !p)} className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors">
              <Shirt className="h-3.5 w-3.5" />
              {showUniform ? "Hide uniform details" : ev.uniformSection}
            </button>
            {showUniform && (
              <div className="mt-3 space-y-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[10px] text-white/40 mb-1">{ev.uniformPrimary}</p>
                    <input type="color" value={uniformColor} onChange={e => setUniformColor(e.target.value)} className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer" style={{ background: "transparent" }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 mb-1">{ev.uniformSecondary}</p>
                    <input type="color" value={uniformSecondaryColor || "#ffffff"} onChange={e => setUniformSecondaryColor(e.target.value)} className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer" style={{ background: "transparent" }} />
                  </div>
                </div>
                <Input value={uniformNotes} onChange={e => setUniformNotes(e.target.value)} placeholder={ev.uniformNotes}
                  className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl text-xs" />
              </div>
            )}
          </div>

          {/* What to bring */}
          <div>
            <label className="stat-label text-white/40 block mb-1.5">{ev.whatToBring}</label>
            <Input value={whatToBring} onChange={e => setWhatToBring(e.target.value)} placeholder="Water bottle, boots, shin pads"
              className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" />
          </div>

          {/* Score (optional — for recording result) */}
          <div>
            <p className="stat-label text-white/40 mb-2">Score (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/30 block mb-1">{isHome ? "Us (Home)" : "Us (Away)"}</label>
                <Input type="number" min={0} value={homeScore} onChange={e => setHomeScore(e.target.value)}
                  placeholder="0" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl text-center text-lg font-bold" />
              </div>
              <div>
                <label className="text-[10px] text-white/30 block mb-1">{isHome ? `${opponent || "Opponent"} (Away)` : `${opponent || "Opponent"} (Home)`}</label>
                <Input type="number" min={0} value={awayScore} onChange={e => setAwayScore(e.target.value)}
                  placeholder="0" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl text-center text-lg font-bold" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="stat-label text-white/40 block mb-1.5">{ev.notes}</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm resize-none" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 border border-white/10 text-white/50 rounded-xl">{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1 font-semibold rounded-xl"
              style={{ background: teamColor, color: "white" }}>
              {loading ? "Saving…" : initial?.id ? g.saveChanges : g.scheduleGame}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteGameDialog({ event, onClose, onDeleted }: { event: EventRow; onClose: () => void; onDeleted: () => void }) {
  const { t } = useI18n();
  const g = t.games;
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted();
      onClose();
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm border-border" style={{ background: "hsl(226,40%,8%)" }}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-white tracking-wide">{g.deleteGameConfirmTitle.toUpperCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.2)" }}>
            <p className="text-sm font-semibold text-white">{event.opponent ? `vs ${event.opponent}` : event.title}</p>
            <p className="text-xs text-white/50 mt-0.5">{formatDateTime(event.startsAt)}</p>
          </div>
          <p className="text-xs text-white/50">{g.deleteGameWarning}</p>
          <div>
            <label className="stat-label text-white/40 block mb-1.5">{g.deleteReason}</label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm resize-none" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="flex-1 border border-white/10 text-white/50 rounded-xl">{t.common.cancel}</Button>
            <Button onClick={handleDelete} disabled={loading} className="flex-1 font-semibold rounded-xl bg-red-500/80 hover:bg-red-500 text-white">
              {loading ? "Deleting…" : g.confirmDelete}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GamesTab({ teamId, teamColor, isCoach }: { teamId: number; teamColor: string; isCoach: boolean }) {
  const { t } = useI18n();
  const g = t.games;
  const ng = t.nextGame;
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"next" | "upcoming" | "past">("next");
  const [nextGame, setNextGame] = useState<EventRow | null>(null);
  const [upcoming, setUpcoming] = useState<EventRow[]>([]);
  const [past, setPast] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRow | undefined>(undefined);
  const [deleteEvent, setDeleteEvent] = useState<EventRow | undefined>(undefined);
  const [viewEvent, setViewEvent] = useState<EventRow | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRes, upcomingRes, pastRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/games?filter=next`),
        fetch(`/api/teams/${teamId}/games?filter=upcoming`),
        fetch(`/api/teams/${teamId}/games?filter=past`),
      ]);
      if (nextRes.ok) setNextGame(await nextRes.json());
      if (upcomingRes.ok) setUpcoming(await upcomingRes.json());
      if (pastRes.ok) setPast(await pastRes.json());
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const SUB_TABS = [
    { value: "next", label: `🔥 ${ng.tabLabel}` },
    { value: "upcoming", label: `📅 ${g.tabUpcoming}` },
    { value: "past", label: `📜 ${g.tabPast}` },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        {isCoach && (
          <Button size="sm" onClick={() => { setEditEvent(undefined); setFormOpen(true); }}
            className="rounded-xl font-semibold" style={{ background: teamColor, color: "white" }}>
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {g.scheduleGame}
          </Button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "hsl(226,40%,10%)" }}>
        {SUB_TABS.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className="flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all"
            style={activeTab === tab.value
              ? { background: "hsl(226,40%,18%)", color: "white" }
              : { color: "rgba(255,255,255,0.5)" }
            }>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
        </div>
      ) : (
        <>
          {activeTab === "next" && (
            nextGame ? (
              <HeroCard event={nextGame} teamColor={teamColor} isCoach={isCoach}
                onEdit={() => { setEditEvent(nextGame); setFormOpen(true); }} />
            ) : (
              <div className="rounded-2xl border border-white/10 p-10 text-center" style={{ background: "hsl(226,40%,10%)" }}>
                <Trophy className="h-10 w-10 mx-auto text-white/15 mb-3" />
                <p className="font-display text-xl text-white/30 tracking-wide">{ng.noGame.toUpperCase()}</p>
                <p className="text-xs text-white/25 mt-1">{ng.noGameDesc}</p>
                {isCoach && (
                  <Button size="sm" onClick={() => setFormOpen(true)} className="mt-4 rounded-xl font-semibold text-xs"
                    style={{ background: teamColor, color: "white" }}>
                    {g.scheduleGame}
                  </Button>
                )}
              </div>
            )
          )}

          {activeTab === "upcoming" && (
            upcoming.length === 0 ? (
              <div className="rounded-2xl border border-white/10 p-10 text-center" style={{ background: "hsl(226,40%,10%)" }}>
                <Calendar className="h-10 w-10 mx-auto text-white/15 mb-3" />
                <p className="text-sm text-white/30">{g.noUpcomingGames}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map(ev => (
                  <GameCard key={ev.id} event={ev} teamColor={teamColor} isCoach={isCoach}
                    onEdit={() => { setEditEvent(ev); setFormOpen(true); }}
                    onDelete={() => setDeleteEvent(ev)}
                    onView={() => { setActiveTab("next"); setNextGame(ev); }} />
                ))}
              </div>
            )
          )}

          {activeTab === "past" && (
            past.length === 0 ? (
              <div className="rounded-2xl border border-white/10 p-10 text-center" style={{ background: "hsl(226,40%,10%)" }}>
                <Calendar className="h-10 w-10 mx-auto text-white/15 mb-3" />
                <p className="text-sm text-white/30">{g.noPastGames}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...past].reverse().map(ev => (
                  <GameCard key={ev.id} event={ev} teamColor={teamColor} isCoach={isCoach}
                    onEdit={() => { setEditEvent(ev); setFormOpen(true); }}
                    onDelete={() => setDeleteEvent(ev)}
                    onView={() => { setActiveTab("next"); setNextGame(ev); }} />
                ))}
              </div>
            )
          )}
        </>
      )}

      <GameForm open={formOpen} onClose={() => setFormOpen(false)} teamId={teamId}
        teamColor={teamColor} initial={editEvent} onSaved={load} />
      {deleteEvent && (
        <DeleteGameDialog event={deleteEvent} onClose={() => setDeleteEvent(undefined)} onDeleted={load} />
      )}
    </div>
  );
}
