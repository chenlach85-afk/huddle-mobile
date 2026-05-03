import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, MapPin, MessageSquare, CheckSquare, Users,
  Pin, Circle, Clock3, CheckCircle2, AlertCircle, Shield
} from "lucide-react";
import { format, formatDistanceToNow, isFuture } from "date-fns";

type MemberTeam = {
  id: number;
  name: string;
  sport: string;
  season: string | null;
  coachName: string;
  avatarColor: string;
  description: string | null;
};

type MemberEvent = {
  id: number;
  title: string;
  type: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
};

type MemberMessage = {
  id: number;
  senderName: string;
  senderRole: string;
  content: string;
  pinned: boolean;
  createdAt: string;
};

type MemberTask = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedToPlayerId: number | null;
  assignedToPlayerName: string | null;
};

type MemberPlayer = {
  id: number;
  name: string;
  number: number | null;
  position: string | null;
  status: string;
};

type MemberData = {
  team: MemberTeam;
  events: MemberEvent[];
  messages: MemberMessage[];
  tasks: MemberTask[];
  players: MemberPlayer[];
};

const TYPE_COLORS: Record<string, string> = {
  practice: "bg-blue-100 text-blue-700 border-blue-200",
  game: "bg-orange-100 text-orange-700 border-orange-200",
  meeting: "bg-purple-100 text-purple-700 border-purple-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-red-600",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock3 className="h-4 w-4 text-blue-500" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

const ROLE_COLORS: Record<string, string> = {
  coach: "bg-primary text-primary-foreground",
  player: "bg-secondary text-secondary-foreground",
  admin: "bg-muted text-muted-foreground",
};

const STATUS_PLAYER: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  injured: "bg-red-100 text-red-700 border-red-200",
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
      <div className="min-h-screen bg-muted/30 p-6 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center gap-4 text-muted-foreground p-6">
        <AlertCircle className="h-14 w-14 text-destructive" />
        <h2 className="text-xl font-semibold text-foreground">Team not found</h2>
        <p className="text-sm text-center max-w-xs">
          This link may be invalid or the team may no longer exist. Ask your coach for the correct link.
        </p>
      </div>
    );
  }

  const { team, events, messages, tasks, players } = data;
  const upcomingEvents = events.filter(e => isFuture(new Date(e.startsAt)));
  const pastEvents = events.filter(e => !isFuture(new Date(e.startsAt)));
  const pinnedMessages = messages.filter(m => m.pinned);
  const regularMessages = messages.filter(m => !m.pinned);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: team.avatarColor }}
            >
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-bold text-sm">{team.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{team.sport}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
            <Shield className="h-3 w-3" />
            Member View
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Team card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
                style={{ backgroundColor: team.avatarColor }}
              >
                {team.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold">{team.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {team.sport}{team.season ? ` • ${team.season}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">Coach: {team.coachName}</p>
                {team.description && <p className="text-sm mt-1">{team.description}</p>}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold">{players.length}</p>
                <p className="text-xs text-muted-foreground">Players</p>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold">{upcomingEvents.length}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <p className="text-lg font-bold">{tasks.filter(t => t.status !== "done").length}</p>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Pin className="h-3 w-3" /> Pinned from Coach
            </h2>
            <div className="space-y-2">
              {pinnedMessages.map(msg => (
                <Card key={msg.id} className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[msg.senderRole]}`}>
                        {msg.senderRole}
                      </span>
                      <span className="text-sm font-medium">{msg.senderName}</span>
                      <Pin className="h-3 w-3 text-primary ml-auto" />
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming schedule */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Upcoming Schedule
          </h2>
          {upcomingEvents.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No upcoming events scheduled.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map(event => (
                <Card key={event.id} data-testid={`member-event-${event.id}`}>
                  <CardContent className="p-4 flex gap-3 items-start">
                    <div className={`text-xs px-2 py-1 rounded border font-medium mt-0.5 shrink-0 ${TYPE_COLORS[event.type]}`}>
                      {event.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.startsAt), "EEEE, MMM d • h:mm a")}
                      </p>
                      {event.location && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />{event.location}
                        </p>
                      )}
                      {event.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{event.notes}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" /> Team Tasks
            </h2>
            <div className="space-y-2">
              {tasks.map(task => (
                <Card key={task.id} className={task.status === "done" ? "opacity-60" : ""} data-testid={`member-task-${task.id}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <span className="mt-0.5">{STATUS_ICONS[task.status]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                        <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                      </div>
                      {task.assignedToPlayerName && (
                        <p className="text-xs text-muted-foreground">Assigned to {task.assignedToPlayerName}</p>
                      )}
                      {task.dueDate && (
                        <p className="text-xs text-muted-foreground">Due {task.dueDate}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Roster */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Roster
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {players.map(player => (
                  <div key={player.id} className="flex items-center gap-3 px-4 py-3" data-testid={`member-player-${player.id}`}>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                      {player.number ?? player.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{player.name}</p>
                      {player.position && <p className="text-xs text-muted-foreground">{player.position}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_PLAYER[player.status]}`}>
                      {player.status}
                    </span>
                  </div>
                ))}
                {players.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No players on roster yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Message feed */}
        {regularMessages.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Team Messages
            </h2>
            <div className="space-y-2">
              {[...regularMessages].reverse().map(msg => (
                <Card key={msg.id} data-testid={`member-message-${msg.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[msg.senderRole]}`}>
                        {msg.senderRole}
                      </span>
                      <span className="text-sm font-medium">{msg.senderName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Past events */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Past Events
            </h2>
            <div className="space-y-2 opacity-70">
              {[...pastEvents].reverse().map(event => (
                <Card key={event.id}>
                  <CardContent className="p-3 flex gap-3 items-center">
                    <div className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${TYPE_COLORS[event.type]}`}>
                      {event.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.startsAt), "MMM d, yyyy • h:mm a")}
                        {event.location ? ` • ${event.location}` : ""}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold">TeamHub</span> — read-only team view
          </p>
        </div>
      </main>
    </div>
  );
}
