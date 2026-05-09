import { useState } from "react";
import {
  useListEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useListAttendance,
  useUpsertAttendance,
  useListPlayers,
  getListEventsQueryKey,
  getListAttendanceQueryKey,
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Calendar, MapPin, Trash2, Pencil, Check, X, HelpCircle, ChevronDown,
  Dumbbell, Swords, HandshakeIcon, Trophy, PartyPopper, Users, MoreHorizontal,
  Home, Plane, Shirt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export const EVENT_TYPES = ["training", "league_game", "friendly_game", "tournament", "celebration", "meeting", "other"] as const;
export type EventType = typeof EVENT_TYPES[number];
const GAME_TYPES: EventType[] = ["league_game", "friendly_game", "tournament"];

export const TYPE_COLORS: Record<EventType, string> = {
  training: "#4a90e2",
  league_game: "#e74c3c",
  friendly_game: "#2ecc71",
  tournament: "#9b59b6",
  celebration: "#f7b538",
  meeting: "#1abc9c",
  other: "rgba(255,255,255,0.35)",
};

const TYPE_ICONS: Record<EventType, React.ComponentType<{ className?: string }>> = {
  training: Dumbbell,
  league_game: Swords,
  friendly_game: HandshakeIcon,
  tournament: Trophy,
  celebration: PartyPopper,
  meeting: Users,
  other: MoreHorizontal,
};

const eventSchema = z.object({
  title: z.string().min(1),
  type: z.enum(EVENT_TYPES).default("training"),
  location: z.string().optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  notes: z.string().optional(),
  opponent: z.string().optional(),
  isHome: z.boolean().optional(),
  arrivalTime: z.string().optional(),
  uniformColor: z.string().optional(),
  uniformSecondaryColor: z.string().optional(),
  uniformNotes: z.string().optional(),
  whatToBring: z.string().optional(),
});
type EventForm = z.infer<typeof eventSchema>;

function TypeCard({ type, selected, onClick, label }: {
  type: EventType; selected: boolean; onClick: () => void; label: string;
}) {
  const color = TYPE_COLORS[type];
  const Icon = TYPE_ICONS[type];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center"
      style={{
        background: selected ? `${color}20` : "rgba(255,255,255,0.03)",
        borderColor: selected ? `${color}60` : "rgba(255,255,255,0.08)",
        color: selected ? color : "rgba(255,255,255,0.4)",
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-[10px] font-bold leading-tight">{label}</span>
    </button>
  );
}

function AttendancePanel({ eventId, teamId, teamColor }: { eventId: number; teamId: number; teamColor: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const ev = t.events;
  const { data: players = [] } = useListPlayers(teamId, { query: { enabled: true, queryKey: [] } });
  const { data: attendance = [] } = useListAttendance(eventId, {
    query: { enabled: !!eventId, queryKey: getListAttendanceQueryKey(eventId) },
  });
  const upsert = useUpsertAttendance();

  const attending = attendance.filter(a => a.status === "attending").length;
  const notAttending = attendance.filter(a => a.status === "not_attending").length;
  const maybe = attendance.filter(a => a.status === "maybe").length;

  function getStatus(playerId: number) {
    return attendance.find(a => a.playerId === playerId)?.status || "no_response";
  }
  function markAttendance(playerId: number, status: "attending" | "not_attending" | "maybe") {
    upsert.mutate({ eventId, data: { playerId, status } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(eventId) }),
      onError: () => toast({ title: ev.failedAttendance, variant: "destructive" }),
    });
  }

  return (
    <div className="border-t border-white/6 pt-4 mt-1">
      <div className="flex items-center gap-4 mb-4 pb-3 border-b border-white/6">
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-[#2ecc71] ltr-num">{attending}</div>
          <div className="stat-label mt-1">{ev.attendanceIn.toUpperCase()}</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-[#e74c3c] ltr-num">{notAttending}</div>
          <div className="stat-label mt-1">{ev.attendanceOut.toUpperCase()}</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-[#f7b538] ltr-num">{maybe}</div>
          <div className="stat-label mt-1">{ev.attendanceMaybe.toUpperCase()}</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-white/30 ltr-num">{players.length - attending - notAttending - maybe}</div>
          <div className="stat-label mt-1">?</div>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="text-xs text-white/30 text-center py-2">{ev.noPlayersYet}</p>
      ) : (
        <div className="space-y-1.5">
          {players.map(player => {
            const status = getStatus(player.id);
            return (
              <div key={player.id} className="flex items-center justify-between py-1" data-testid={`attendance-player-${player.id}`}>
                <div className="flex items-center gap-2.5">
                  <div className="jersey-tile w-7 h-7 text-xs" style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}88)` }}>
                    <span className="ltr-num">{player.number ?? player.name.charAt(0)}</span>
                  </div>
                  <span className="text-sm text-white/70">{player.name}</span>
                </div>
                <div className="flex gap-1">
                  {[
                    { s: "attending" as const, icon: Check, color: "#2ecc71", label: ev.attendanceIn },
                    { s: "maybe" as const, icon: HelpCircle, color: "#f7b538", label: "?" },
                    { s: "not_attending" as const, icon: X, color: "#e74c3c", label: ev.attendanceOut },
                  ].map(({ s, icon: Icon, color, label }) => (
                    <button
                      key={s}
                      onClick={() => markAttendance(player.id, s)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold"
                      style={{
                        background: status === s ? `${color}30` : "rgba(255,255,255,0.04)",
                        color: status === s ? color : "rgba(255,255,255,0.25)",
                        border: status === s ? `1px solid ${color}60` : "1px solid rgba(255,255,255,0.06)",
                      }}
                      title={label}
                      data-testid={`btn-${s === "attending" ? "attending" : s === "maybe" ? "maybe" : "not-attending"}-${player.id}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EventsTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, formatDateTime } = useI18n();
  const ev = t.events;

  const typeLabel = (type: string): string => {
    const map: Record<string, string> = {
      training: ev.typeTraining,
      league_game: ev.typeLeagueGame,
      friendly_game: ev.typeFriendlyGame,
      tournament: ev.typeTournament,
      celebration: ev.typeCelebration,
      meeting: ev.typeMeeting,
      other: ev.typeOther,
      practice: ev.typeTraining,
      game: ev.typeLeagueGame,
    };
    return map[type] ?? type;
  };

  const { data: events = [], isLoading } = useListEvents(teamId, {
    query: { enabled: !!teamId, queryKey: getListEventsQueryKey(teamId) },
  });
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "", type: "training", location: "", startsAt: "", endsAt: "",
      notes: "", opponent: "", arrivalTime: "", uniformColor: "",
      uniformSecondaryColor: "", uniformNotes: "", whatToBring: "",
    },
  });

  const currentType = form.watch("type") as EventType;
  const isGameType = GAME_TYPES.includes(currentType);

  function openCreate() {
    form.reset({
      title: "", type: "training", location: "", startsAt: "", endsAt: "",
      notes: "", opponent: "", arrivalTime: "", uniformColor: "",
      uniformSecondaryColor: "", uniformNotes: "", whatToBring: "",
    });
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(e: typeof events[0]) {
    const type = (EVENT_TYPES as readonly string[]).includes(e.type) ? e.type as EventType : "training";
    form.reset({
      title: e.title,
      type,
      location: e.location || "",
      notes: e.notes || "",
      startsAt: new Date(e.startsAt).toISOString().slice(0, 16),
      endsAt: e.endsAt ? new Date(e.endsAt).toISOString().slice(0, 16) : "",
      opponent: (e as any).opponent || "",
      isHome: (e as any).isHome ?? undefined,
      arrivalTime: (e as any).arrivalTime ? new Date((e as any).arrivalTime).toISOString().slice(0, 16) : "",
      uniformColor: (e as any).uniformColor || "",
      uniformSecondaryColor: (e as any).uniformSecondaryColor || "",
      uniformNotes: (e as any).uniformNotes || "",
      whatToBring: (e as any).whatToBring || "",
    });
    setEditingId(e.id);
    setOpen(true);
  }

  function onSubmit(values: EventForm) {
    const payload = {
      title: values.title,
      type: values.type,
      location: values.location || null,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
      notes: values.notes || null,
      opponent: values.opponent || null,
      isHome: values.isHome ?? null,
      arrivalTime: values.arrivalTime ? new Date(values.arrivalTime).toISOString() : null,
      uniformColor: values.uniformColor || null,
      uniformSecondaryColor: values.uniformSecondaryColor || null,
      uniformNotes: values.uniformNotes || null,
      whatToBring: values.whatToBring || null,
    };
    if (editingId) {
      updateEvent.mutate({ eventId: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); setOpen(false); toast({ title: ev.eventUpdated }); },
        onError: () => toast({ title: ev.failedUpdate, variant: "destructive" }),
      });
    } else {
      createEvent.mutate({ teamId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); setOpen(false); toast({ title: ev.eventAdded }); },
        onError: () => toast({ title: ev.failedCreate, variant: "destructive" }),
      });
    }
  }

  function handleDelete(eventId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(ev.confirmDelete)) return;
    deleteEvent.mutate({ eventId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); if (expandedId === eventId) setExpandedId(null); toast({ title: ev.eventDeleted }); },
      onError: () => toast({ title: ev.failedDelete, variant: "destructive" }),
    });
  }

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-label"><span className="ltr-num">{events.length}</span> {ev.eventsInLineup}</p>
        <Button size="sm" onClick={openCreate} className="font-semibold rounded-xl" style={{ background: teamColor, color: "white" }} data-testid="button-add-event">
          <Plus className="h-3.5 w-3.5 me-1.5" />
          {ev.addEvent}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-border p-10 text-center" style={{ background: "var(--surface-card)" }}>
          <Calendar className="h-10 w-10 mx-auto text-white/15 mb-3" />
          <p className="font-display text-xl text-white/30 tracking-wide">{ev.emptyLineup.toUpperCase()}</p>
          <p className="text-xs text-white/25 mt-1 mb-4">{ev.scheduleFirstEvent}</p>
          <Button size="sm" onClick={openCreate} style={{ background: teamColor, color: "white" }} className="rounded-xl font-semibold">{ev.addEvent}</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => {
            const color = TYPE_COLORS[event.type as EventType] ?? "rgba(255,255,255,0.3)";
            const isExpanded = expandedId === event.id;
            const Icon = TYPE_ICONS[event.type as EventType] ?? MoreHorizontal;
            const eAny = event as any;
            return (
              <div key={event.id} className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }} data-testid={`card-event-${event.id}`}>
                <div
                  className="p-4 flex items-start gap-3 cursor-pointer hover:bg-white/3 transition-colors group"
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  <div className="mt-0.5 flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0"
                    style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                    <Icon className="h-2.5 w-2.5" />
                    {typeLabel(event.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-sm" data-testid={`text-event-title-${event.id}`}>{event.title}</h4>
                    {eAny.opponent && (
                      <p className="text-xs font-medium mt-0.5" style={{ color }}>
                        {eAny.isHome === true ? `🏠 vs ${eAny.opponent}` : eAny.isHome === false ? `✈ @ ${eAny.opponent}` : `vs ${eAny.opponent}`}
                      </p>
                    )}
                    <p className="text-xs text-white/40 mt-0.5 font-medium ltr-num">
                      {formatDateTime(new Date(event.startsAt))}
                    </p>
                    {event.location && (
                      <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />{event.location}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-bold ltr-num" style={{ color: teamColor }}>
                      {event.attendingCount}/{event.totalCount}
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ms-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/8" onClick={(e) => { e.stopPropagation(); openEdit(event); }} data-testid={`button-edit-event-${event.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/40 hover:text-red-400 hover:bg-red-400/10" onClick={(e) => handleDelete(event.id, e)} data-testid={`button-delete-event-${event.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-white/20 transition-transform ms-1 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <AttendancePanel eventId={event.id} teamId={teamId} teamColor={teamColor} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">
              {editingId ? ev.editEvent.toUpperCase() : ev.addEvent.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{ev.title}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-event-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{ev.type}</FormLabel>
                  <div className="grid grid-cols-4 gap-1.5" data-testid="select-event-type">
                    {EVENT_TYPES.map(et => (
                      <TypeCard
                        key={et}
                        type={et}
                        selected={field.value === et}
                        onClick={() => field.onChange(et)}
                        label={typeLabel(et)}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{ev.startsAt}</FormLabel>
                    <FormControl><Input type="datetime-local" className="bg-white/6 border-white/10 text-white rounded-xl ltr-num" data-testid="input-starts-at" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endsAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{ev.endsAt}</FormLabel>
                    <FormControl><Input type="datetime-local" className="bg-white/6 border-white/10 text-white rounded-xl ltr-num" data-testid="input-ends-at" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{ev.location}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-location" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Game-specific section */}
              {isGameType && (
                <div className="space-y-3 rounded-xl p-3 border border-white/8" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <p className="stat-label text-white/40 text-[10px] uppercase tracking-widest">{ev.gameSection}</p>

                  <FormField control={form.control} name="opponent" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="stat-label text-white/50">{ev.opponent}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. FC Barcelona"
                          className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="isHome" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="stat-label text-white/50">{ev.homeOrAway}</FormLabel>
                      <div className="flex gap-2">
                        {[
                          { val: true, label: ev.home, icon: Home, color: "#2ecc71" },
                          { val: false, label: ev.away, icon: Plane, color: "#3498db" },
                        ].map(({ val, label, icon: Icon, color }) => (
                          <button
                            type="button"
                            key={String(val)}
                            onClick={() => field.onChange(field.value === val ? undefined : val)}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5"
                            style={{
                              background: field.value === val ? `${color}20` : "rgba(255,255,255,0.04)",
                              borderColor: field.value === val ? `${color}50` : "rgba(255,255,255,0.08)",
                              color: field.value === val ? color : "rgba(255,255,255,0.4)",
                            }}
                          >
                            <Icon className="h-3 w-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="arrivalTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="stat-label text-white/50">{ev.arrivalTime}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" className="bg-white/6 border-white/10 text-white rounded-xl ltr-num" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              )}

              {/* Uniform section */}
              <div className="space-y-3 rounded-xl p-3 border border-white/8" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="stat-label text-white/40 text-[10px] uppercase tracking-widest flex items-center gap-1.5">
                  <Shirt className="h-3 w-3" />{ev.uniformSection}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="uniformColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="stat-label text-white/50">{ev.uniformPrimary}</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-xl px-3 py-2">
                          <input
                            type="color"
                            value={field.value || "#ffffff"}
                            onChange={e => field.onChange(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                          <input
                            type="text"
                            value={field.value || ""}
                            onChange={e => field.onChange(e.target.value)}
                            placeholder="#ffffff"
                            className="flex-1 bg-transparent text-white text-xs border-0 outline-none placeholder:text-white/30"
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="uniformSecondaryColor" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="stat-label text-white/50">{ev.uniformSecondary}</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-xl px-3 py-2">
                          <input
                            type="color"
                            value={field.value || "#000000"}
                            onChange={e => field.onChange(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                          <input
                            type="text"
                            value={field.value || ""}
                            onChange={e => field.onChange(e.target.value)}
                            placeholder="#000000"
                            className="flex-1 bg-transparent text-white text-xs border-0 outline-none placeholder:text-white/30"
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="uniformNotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{ev.uniformNotes}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={ev.uniformNotesPlaceholder}
                        className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="whatToBring" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{ev.whatToBring}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={ev.whatToBringPlaceholder}
                      className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{ev.notes}</FormLabel>
                  <FormControl><Textarea className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-event-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full font-semibold rounded-xl h-11" style={{ background: teamColor, color: "white" }} disabled={isPending} data-testid="button-submit-event">
                {isPending ? t.common.saving : editingId ? ev.updateEvent : ev.addToLineup}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
