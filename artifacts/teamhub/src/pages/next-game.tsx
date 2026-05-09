import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Trophy, MapPin, Clock, Calendar, Users, MessageCircle, Pencil, ArrowRight,
  Home, Plane, Shirt, Package,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";

type EventRow = {
  id: number;
  title: string;
  type: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
  opponent: string | null;
  isHome: boolean | null;
  arrivalTime: string | null;
  uniformColor: string | null;
  uniformSecondaryColor: string | null;
  uniformNotes: string | null;
  whatToBring: string | null;
};

type AttendanceRow = {
  id: number;
  playerId: number;
  status: "in" | "out" | "maybe" | null;
  playerName: string | null;
  playerNumber: number | null;
  playerPosition: string | null;
};

const TYPE_COLORS: Record<string, string> = {
  league_game:    "#FF6B35",
  friendly_game:  "#3498db",
  tournament:     "#9b59b6",
};

const TYPE_LABELS: Record<string, string> = {
  league_game:    "League Game",
  friendly_game:  "Friendly",
  tournament:     "Tournament",
};

function Countdown({ target, ng }: { target: Date; ng: { days: string; hours: string; mins: string; secs: string; countdown: string } }) {
  const [diff, setDiff] = useState(0);

  useEffect(() => {
    const update = () => setDiff(Math.max(0, target.getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);

  const totalSecs = Math.floor(diff / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;

  return (
    <div className="flex gap-3 justify-center">
      {[
        { v: d, label: ng.days },
        { v: h, label: ng.hours },
        { v: m, label: ng.mins },
        { v: s, label: ng.secs },
      ].map(({ v, label }) => (
        <div key={label} className="flex flex-col items-center">
          <span className="font-display text-3xl text-white ltr-num leading-none">{String(v).padStart(2, "0")}</span>
          <span className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">{label}</span>
        </div>
      ))}
    </div>
  );
}

function AttendanceGroup({
  label, color, members, teamColor,
}: { label: string; color: string; members: string[]; teamColor: string }) {
  if (members.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color }}>{label} ({members.length})</p>
      <div className="flex flex-wrap gap-1">
        {members.map(name => (
          <span key={name} className="px-2 py-0.5 rounded-lg text-xs text-white/70 font-medium"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function NextGameTab({
  teamId,
  teamColor,
  isOwner,
}: {
  teamId: number;
  teamColor: string;
  isOwner: boolean;
}) {
  const { t, formatDateTime } = useI18n();
  const ng = t.nextGame;
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/next-game`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event ?? null);
        setAttendance(data.attendance ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const typeColor = event ? (TYPE_COLORS[event.type] ?? teamColor) : teamColor;
  const typeLabel = event ? (TYPE_LABELS[event.type] ?? event.type) : "";

  const confirmed = attendance.filter(a => a.status === "in").map(a => a.playerName ?? "?");
  const maybe = attendance.filter(a => a.status === "maybe").map(a => a.playerName ?? "?");
  const out = attendance.filter(a => a.status === "out").map(a => a.playerName ?? "?");
  const noResponse = attendance.filter(a => !a.status).map(a => a.playerName ?? "?");

  const whatsappPlayers = attendance.filter(a => !a.status && a.playerName);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        <Skeleton className="h-32 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
        <div className="py-16 px-8 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-white/40 font-semibold text-sm">{ng.noGame}</p>
          <p className="text-white/20 text-xs mt-1">{ng.noGameDesc}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-6 text-white/40 hover:text-white border border-white/10 rounded-xl"
            onClick={() => setLocation(`/teams/${teamId}?tab=events`)}
          >
            <Calendar className="h-3.5 w-3.5 me-1.5" />
            {ng.goToSchedule}
          </Button>
        </div>
      </div>
    );
  }

  const startsAt = new Date(event.startsAt);
  const isPast = startsAt < new Date();

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: `${typeColor}30`, background: `linear-gradient(135deg, ${typeColor}12 0%, rgba(255,255,255,0.02) 100%)` }}>
        {/* Type banner */}
        <div className="px-4 py-2 flex items-center justify-between" style={{ background: `${typeColor}18`, borderBottom: `1px solid ${typeColor}20` }}>
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" style={{ color: typeColor }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: typeColor }}>{typeLabel}</span>
          </div>
          {isOwner && (
            <button
              onClick={() => setLocation(`/teams/${teamId}?tab=events`)}
              className="flex items-center gap-1 text-[10px] font-semibold transition-colors hover:opacity-100 opacity-60"
              style={{ color: typeColor }}
            >
              <Pencil className="h-2.5 w-2.5" />
              {ng.editGame}
            </button>
          )}
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Title + opponent */}
          <div>
            <h2 className="font-display text-2xl text-white tracking-wide leading-tight">
              {event.title.toUpperCase()}
            </h2>
            {event.opponent && (
              <div className="flex items-center gap-2 mt-2">
                {event.isHome === true && <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: "#2ecc7118", color: "#2ecc71", border: "1px solid #2ecc7130" }}><Home className="h-2.5 w-2.5" /> {t.events.home}</span>}
                {event.isHome === false && <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: "#3498db18", color: "#3498db", border: "1px solid #3498db30" }}><Plane className="h-2.5 w-2.5" /> {t.events.away}</span>}
                <span className="text-sm text-white/60">vs <span className="text-white font-semibold">{event.opponent}</span></span>
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: typeColor }} />
              <span className="text-sm text-white/80 font-semibold">{formatDateTime(event.startsAt)}</span>
            </div>
            {event.arrivalTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0text-[#f7b538]" style={{ color: "#f7b538" }} />
                <span className="text-xs text-white/60">{t.events.arrivalTime}: <span className="font-semibold text-white/80">{formatDateTime(event.arrivalTime)}</span></span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: typeColor }} />
                <span className="text-sm text-white/60">{event.location}</span>
              </div>
            )}
            {!isPast && !event.arrivalTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: typeColor }} />
                <span className="text-xs text-white/40">
                  {formatDistanceToNow(startsAt, { addSuffix: true })}
                </span>
              </div>
            )}
          </div>

          {/* Uniform + what to bring */}
          {(event.uniformColor || event.uniformNotes || event.whatToBring) && (
            <div className="space-y-2">
              {(event.uniformColor || event.uniformNotes) && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Shirt className="h-3.5 w-3.5 shrink-0 text-white/40" />
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    {event.uniformColor && (
                      <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ background: event.uniformColor }} />
                    )}
                    {event.uniformSecondaryColor && (
                      <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ background: event.uniformSecondaryColor }} />
                    )}
                    {event.uniformNotes && <span className="text-xs text-white/60">{event.uniformNotes}</span>}
                  </div>
                </div>
              )}
              {event.whatToBring && (
                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Package className="h-3.5 w-3.5 shrink-0 text-white/40 mt-0.5" />
                  <span className="text-xs text-white/60">{event.whatToBring}</span>
                </div>
              )}
            </div>
          )}

          {/* Countdown */}
          {!isPast && (
            <div className="rounded-xl py-4" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-center text-[9px] uppercase tracking-widest text-white/30 mb-3">{ng.countdown}</p>
              <Countdown target={startsAt} ng={ng} />
            </div>
          )}
        </div>
      </div>

      {/* Attendance breakdown */}
      {attendance.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
          <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
            <Users className="h-3.5 w-3.5" style={{ color: teamColor }} />
            <p className="text-xs font-bold uppercase tracking-widest text-white/50">{ng.squadStatus}</p>
          </div>

          {/* Summary chips */}
          <div className="px-4 py-3 flex gap-2 flex-wrap border-b border-white/4">
            {[
              { count: confirmed.length, label: ng.confirmed, color: "#2ecc71" },
              { count: maybe.length, label: ng.maybe, color: "#f39c12" },
              { count: out.length, label: ng.cantMake, color: "#e74c3c" },
              { count: noResponse.length, label: ng.noResponse, color: "rgba(255,255,255,0.25)" },
            ].map(({ count, label, color }) => count > 0 && (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
                <span className="text-sm font-bold ltr-num" style={{ color }}>{count}</span>
                <span className="text-xs" style={{ color }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Groups */}
          <div className="px-4 py-4 space-y-4">
            <AttendanceGroup label={ng.confirmed} color="#2ecc71" members={confirmed} teamColor={teamColor} />
            <AttendanceGroup label={ng.maybe} color="#f39c12" members={maybe} teamColor={teamColor} />
            <AttendanceGroup label={ng.cantMake} color="#e74c3c" members={out} teamColor={teamColor} />
            <AttendanceGroup label={ng.noResponse} color="rgba(255,255,255,0.3)" members={noResponse} teamColor={teamColor} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm font-semibold"
          onClick={() => setLocation(`/teams/${teamId}?tab=events`)}
        >
          <ArrowRight className="h-3.5 w-3.5 me-1.5" />
          {ng.goToSchedule}
        </Button>
        {whatsappPlayers.length > 0 && (
          <Button
            variant="ghost"
            className="rounded-xl border border-green-500/30 text-green-400/70 hover:text-green-400 text-sm font-semibold"
            onClick={() => {
              const names = whatsappPlayers.slice(0, 3).map(a => a.playerName).join(", ");
              const msg = `Hi! Just a reminder about the ${typeLabel} — ${event.title}. Are you coming? Reply: In / Maybe / Can't make it`;
              const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
              window.open(url, "_blank");
            }}
          >
            <MessageCircle className="h-3.5 w-3.5 me-1.5" />
            {ng.whatsappReminder} ({whatsappPlayers.length})
          </Button>
        )}
      </div>
    </div>
  );
}
