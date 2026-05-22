import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, MapPin, MessageSquare, CheckSquare, Users,
  Pin, Circle, Clock3, CheckCircle2, AlertCircle, Zap,
} from "lucide-react";
import { format, formatDistanceToNow, isFuture } from "date-fns";

type MemberTeam = {
  id: number; name: string; sport: string; season: string | null;
  coachName: string; avatarColor: string; description: string | null;
};
type MemberEvent = {
  id: number; title: string; type: string; location: string | null;
  startsAt: string; endsAt: string | null; notes: string | null;
};
type MemberMessage = {
  id: number; senderName: string; senderRole: string;
  content: string; pinned: boolean; createdAt: string;
};
type MemberTask = {
  id: number; title: string; description: string | null;
  status: string; priority: string; dueDate: string | null;
  assignedToPlayerId: number | null; assignedToPlayerName: string | null;
};
type MemberPlayer = {
  id: number; name: string; number: number | null; position: string | null; status: string;
};
type MemberData = {
  team: MemberTeam; events: MemberEvent[]; messages: MemberMessage[];
  tasks: MemberTask[]; players: MemberPlayer[];
};

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  practice: { color: "#4a90e2", label: "Practice" },
  game: { color: "#FF6B35", label: "Game" },
  meeting: { color: "#9b59b6", label: "Meeting" },
  other: { color: "rgba(255,255,255,0.3)", label: "Other" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: "#2ecc71", label: "LOW" },
  medium: { color: "#f7b538", label: "MED" },
  high: { color: "#e74c3c", label: "HIGH" },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4" style={{ color: "rgba(255,255,255,0.3)" }} />,
  in_progress: <Clock3 className="h-4 w-4" style={{ color: "#4a90e2" }} />,
  done: <CheckCircle2 className="h-4 w-4" style={{ color: "#2ecc71" }} />,
};

const STATUS_PLAYER: Record<string, { color: string; label: string }> = {
  active: { color: "#2ecc71", label: "Active" },
  inactive: { color: "rgba(255,255,255,0.3)", label: "Inactive" },
  injured: { color: "#e74c3c", label: "Injured" },
};

const ROLE_CONFIG: Record<string, { color: string; label: string }> = {
  coach: { color: "#FF6B35", label: "COACH" },
  player: { color: "#4a90e2", label: "PLAYER" },
  admin: { color: "#9b59b6", label: "ADMIN" },
};

export default function MemberView() {
  const { joinCode } = useParams<{ joinCode: string }>();

  const { data, isLoading, error } = useQuery<MemberData>({
    queryKey: ["member", joinCode],
    queryFn: async () => {
      const res = await fetch(`/api/member/${joinCode}`);
      if (!res.ok) throw new Error("Team not found");
      return res.json();
    },
    enabled: !!joinCode,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen p-5 flex items-center justify-center" style={{ background: "var(--surface-sidebar)" }}>
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Skeleton className="h-32 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Skeleton className="h-32 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6" style={{ background: "var(--surface-sidebar)" }}>
        <AlertCircle className="h-14 w-14 text-red-500" />
        <h2 className="font-display text-3xl text-white tracking-wide">TEAM NOT FOUND</h2>
        <p className="text-sm text-center text-white/40 max-w-xs">
          This link may be invalid or the team no longer exists. Ask your coach for the correct link.
        </p>
      </div>
    );
  }

  const { team, events, messages, tasks, players } = data;
  const tc = team.avatarColor || "#FF6B35";
  const upcomingEvents = events.filter(e => isFuture(new Date(e.startsAt)));
  const pastEvents = events.filter(e => !isFuture(new Date(e.startsAt)));
  const pinnedMessages = messages.filter(m => m.pinned);
  const regularMessages = messages.filter(m => !m.pinned);
  const openTasks = tasks.filter(t => t.status !== "done").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-sidebar)" }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-white/6"
        style={{ background: "var(--surface-sidebar)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="jersey-tile w-8 h-8 text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${tc}, ${tc}88)` }}>
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-semibold text-sm text-white">{team.name}</span>
              <span className="text-xs text-white/40 ml-2">{team.sport}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50 px-2.5 py-1 rounded-lg border border-white/10"
            style={{ background: "rgba(255,255,255,0.04)" }}>
            <Zap className="h-3 w-3" style={{ color: tc }} />
            Member View
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Team hero card */}
        <div className="hero-card p-5" style={{
          background: `linear-gradient(135deg, ${tc}cc 0%, ${tc}44 100%)`,
          border: `1px solid ${tc}33`,
        }}>
          <div className="flex items-center gap-4">
            <div className="jersey-tile w-14 h-14 text-2xl shrink-0"
              style={{ background: "rgba(255,255,255,0.2)", color: "white", borderRadius: "14px" }}>
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-3xl text-white tracking-wide leading-none">{team.name.toUpperCase()}</h1>
              <p className="text-white/60 text-sm font-medium mt-1">
                {team.sport}{team.season ? ` · ${team.season}` : ""}
              </p>
              <p className="text-white/50 text-sm">Coach: {team.coachName}</p>
            </div>
          </div>

          {/* Scoreboard stats */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="stat-value">{players.length}</div>
              <div className="stat-label mt-1">Players</div>
            </div>
            <div className="text-center">
              <div className="stat-value">{upcomingEvents.length}</div>
              <div className="stat-label mt-1">Upcoming</div>
            </div>
            <div className="text-center">
              <div className="stat-value" style={{ color: openTasks > 0 ? "#f7b538" : "white" }}>{openTasks}</div>
              <div className="stat-label mt-1">Open Tasks</div>
            </div>
          </div>
        </div>

        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div>
            <p className="section-label flex items-center gap-1.5 mb-2">
              <Pin className="h-2.5 w-2.5" style={{ color: tc }} />
              Pinned from Coach
            </p>
            <div className="space-y-2">
              {pinnedMessages.map(msg => (
                <div key={msg.id} className="rounded-2xl p-4 border"
                  style={{ background: `${tc}10`, borderColor: `${tc}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${tc}25`, color: tc }}>
                      {ROLE_CONFIG[msg.senderRole]?.label ?? msg.senderRole.toUpperCase()}
                    </span>
                    <span className="text-sm font-semibold text-white">{msg.senderName}</span>
                    <Pin className="h-3 w-3 ml-auto" style={{ color: tc }} />
                  </div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <p className="text-xs text-white/30 mt-2">
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming schedule */}
        <div>
          <p className="section-label flex items-center gap-1.5 mb-2">
            <Calendar className="h-2.5 w-2.5" />
            Upcoming Schedule
          </p>
          {upcomingEvents.length === 0 ? (
            <div className="rounded-2xl border border-border p-6 text-center text-white/30 text-sm"
              style={{ background: "var(--surface-card)" }}>
              No upcoming events scheduled.
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(event => {
                const typeCfg = TYPE_CONFIG[event.type] ?? { color: "rgba(255,255,255,0.3)", label: event.type };
                return (
                  <div key={event.id} className="rounded-2xl border border-border p-4 flex gap-3 items-start"
                    style={{ background: "var(--surface-card)" }}
                    data-testid={`member-event-${event.id}`}>
                    <div className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0 mt-0.5"
                      style={{ background: `${typeCfg.color}20`, color: typeCfg.color, border: `1px solid ${typeCfg.color}40` }}>
                      {typeCfg.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm">{event.title}</p>
                      <p className="text-xs text-white/45 font-medium mt-0.5">
                        {format(new Date(event.startsAt), "EEE, MMM d · h:mm a")}
                      </p>
                      {event.location && (
                        <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />{event.location}
                        </p>
                      )}
                      {event.notes && <p className="text-xs text-white/25 mt-1 italic">{event.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <div>
            <p className="section-label flex items-center gap-1.5 mb-2">
              <CheckSquare className="h-2.5 w-2.5" />
              Team Tasks
            </p>
            <div className="space-y-2">
              {tasks.map(task => {
                const priorityCfg = PRIORITY_CONFIG[task.priority] ?? { color: "#fff", label: task.priority };
                return (
                  <div key={task.id}
                    className={`rounded-2xl border border-border p-3.5 flex items-start gap-3 ${task.status === "done" ? "opacity-50" : ""}`}
                    style={{ background: "var(--surface-card)" }}
                    data-testid={`member-task-${task.id}`}>
                    <span className="mt-0.5 shrink-0">{STATUS_ICONS[task.status]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold text-white ${task.status === "done" ? "line-through text-white/40" : ""}`}>
                          {task.title}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: `${priorityCfg.color}18`, color: priorityCfg.color }}>
                          {priorityCfg.label}
                        </span>
                      </div>
                      {task.assignedToPlayerName && (
                        <p className="text-xs text-white/35 mt-0.5">Assigned to {task.assignedToPlayerName}</p>
                      )}
                      {task.dueDate && <p className="text-xs text-white/30">Due {task.dueDate}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Roster */}
        <div>
          <p className="section-label flex items-center gap-1.5 mb-2">
            <Users className="h-2.5 w-2.5" />
            Squad Roster
          </p>
          <div className="rounded-2xl border border-border overflow-hidden divide-y divide-white/5"
            style={{ background: "var(--surface-card)" }}>
            {players.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-6">No players on roster yet.</p>
            ) : (
              players.map(player => {
                const statusCfg = STATUS_PLAYER[player.status] ?? { color: "rgba(255,255,255,0.3)", label: player.status };
                return (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-3"
                    data-testid={`member-player-${player.id}`}>
                    <div className="jersey-tile w-8 h-8 text-sm shrink-0"
                      style={{ background: `linear-gradient(135deg, ${tc}, ${tc}88)` }}>
                      {player.number ?? player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{player.name}</p>
                      {player.position && <p className="text-xs text-white/35">{player.position}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${statusCfg.color}20`, color: statusCfg.color }}>
                      {statusCfg.label.toUpperCase()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Messages */}
        {regularMessages.length > 0 && (
          <div>
            <p className="section-label flex items-center gap-1.5 mb-2">
              <MessageSquare className="h-2.5 w-2.5" />
              Team Messages
            </p>
            <div className="space-y-2">
              {[...regularMessages].reverse().map(msg => {
                const roleCfg = ROLE_CONFIG[msg.senderRole] ?? { color: "#fff", label: msg.senderRole.toUpperCase() };
                return (
                  <div key={msg.id} className="rounded-2xl border border-border p-4"
                    style={{ background: "var(--surface-card)", borderLeft: `3px solid ${roleCfg.color}50` }}
                    data-testid={`member-message-${msg.id}`}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${roleCfg.color}20`, color: roleCfg.color }}>
                        {roleCfg.label}
                      </span>
                      <span className="text-sm font-semibold text-white">{msg.senderName}</span>
                      <span className="text-xs text-white/25 ml-auto">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Past events */}
        {pastEvents.length > 0 && (
          <div className="opacity-50">
            <p className="section-label flex items-center gap-1.5 mb-2">
              <Calendar className="h-2.5 w-2.5" />
              Past Events
            </p>
            <div className="space-y-2">
              {[...pastEvents].reverse().map(event => {
                const typeCfg = TYPE_CONFIG[event.type] ?? { color: "rgba(255,255,255,0.3)", label: event.type };
                return (
                  <div key={event.id} className="rounded-2xl border border-border p-3.5 flex gap-3 items-center"
                    style={{ background: "var(--surface-card)" }}>
                    <div className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0"
                      style={{ background: `${typeCfg.color}18`, color: typeCfg.color }}>
                      {typeCfg.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{event.title}</p>
                      <p className="text-xs text-white/35">
                        {format(new Date(event.startsAt), "MMM d, yyyy · h:mm a")}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-white/20">
            Powered by <span className="font-semibold text-white/35">Clasiko</span> — read-only member view
          </p>
        </div>
      </main>
    </div>
  );
}
