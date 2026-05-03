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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Calendar, MapPin, Trash2, Pencil, Check, X, HelpCircle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  practice: { label: "Practice", color: "#4a90e2" },
  game: { label: "Game", color: "#FF6B35" },
  meeting: { label: "Meeting", color: "#9b59b6" },
  other: { label: "Other", color: "rgba(255,255,255,0.3)" },
};

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["practice", "game", "meeting", "other"]).default("practice"),
  location: z.string().optional(),
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string().optional(),
  notes: z.string().optional(),
});
type EventForm = z.infer<typeof eventSchema>;

function AttendancePanel({ eventId, teamId, teamColor }: { eventId: number; teamId: number; teamColor: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
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
      onError: () => toast({ title: "Failed to update attendance", variant: "destructive" }),
    });
  }

  return (
    <div className="border-t border-white/6 pt-4 mt-1">
      {/* Scoreboard stats */}
      <div className="flex items-center gap-4 mb-4 pb-3 border-b border-white/6">
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-[#2ecc71]">{attending}</div>
          <div className="stat-label mt-1">IN</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-[#e74c3c]">{notAttending}</div>
          <div className="stat-label mt-1">OUT</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-[#f7b538]">{maybe}</div>
          <div className="stat-label mt-1">MAYBE</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="font-display text-3xl leading-none text-white/30">{players.length - attending - notAttending - maybe}</div>
          <div className="stat-label mt-1">?</div>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="text-xs text-white/30 text-center py-2">No players on squad yet.</p>
      ) : (
        <div className="space-y-1.5">
          {players.map(player => {
            const status = getStatus(player.id);
            return (
              <div key={player.id} className="flex items-center justify-between py-1" data-testid={`attendance-player-${player.id}`}>
                <div className="flex items-center gap-2.5">
                  <div className="jersey-tile w-7 h-7 text-xs" style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}88)` }}>
                    {player.number ?? player.name.charAt(0)}
                  </div>
                  <span className="text-sm text-white/70">{player.name}</span>
                </div>
                <div className="flex gap-1">
                  {[
                    { s: "attending" as const, icon: Check, color: "#2ecc71", label: "In" },
                    { s: "maybe" as const, icon: HelpCircle, color: "#f7b538", label: "?" },
                    { s: "not_attending" as const, icon: X, color: "#e74c3c", label: "Out" },
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

  const { data: events = [], isLoading } = useListEvents(teamId, {
    query: { enabled: !!teamId, queryKey: getListEventsQueryKey(teamId) },
  });
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: "", type: "practice", location: "", startsAt: "", endsAt: "", notes: "" },
  });

  function openCreate() { form.reset(); setEditingId(null); setOpen(true); }
  function openEdit(e: typeof events[0]) {
    form.reset({
      title: e.title, type: e.type, location: e.location || "", notes: e.notes || "",
      startsAt: new Date(e.startsAt).toISOString().slice(0, 16),
      endsAt: e.endsAt ? new Date(e.endsAt).toISOString().slice(0, 16) : "",
    });
    setEditingId(e.id);
    setOpen(true);
  }

  function onSubmit(values: EventForm) {
    const payload = {
      title: values.title, type: values.type,
      location: values.location || null,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
      notes: values.notes || null,
    };
    if (editingId) {
      updateEvent.mutate({ eventId: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); setOpen(false); toast({ title: "Event updated" }); },
        onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
      });
    } else {
      createEvent.mutate({ teamId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); setOpen(false); toast({ title: "Event added to lineup" }); },
        onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
      });
    }
  }

  function handleDelete(eventId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this event?")) return;
    deleteEvent.mutate({ eventId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); if (expandedId === eventId) setExpandedId(null); toast({ title: "Event deleted" }); },
      onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
    });
  }

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-label">{events.length} EVENTS IN LINEUP</p>
        <Button size="sm" onClick={openCreate} className="font-semibold rounded-xl" style={{ background: teamColor, color: "white" }} data-testid="button-add-event">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Event
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-white/6 p-10 text-center" style={{ background: "rgba(22,27,46,0.8)" }}>
          <Calendar className="h-10 w-10 mx-auto text-white/15 mb-3" />
          <p className="font-display text-xl text-white/30 tracking-wide">EMPTY LINEUP</p>
          <p className="text-xs text-white/25 mt-1 mb-4">Schedule your first practice or game</p>
          <Button size="sm" onClick={openCreate} style={{ background: teamColor, color: "white" }} className="rounded-xl font-semibold">Add Event</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => {
            const typeCfg = TYPE_CONFIG[event.type];
            const isExpanded = expandedId === event.id;
            return (
              <div key={event.id} className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(22,27,46,0.8)" }} data-testid={`card-event-${event.id}`}>
                <div
                  className="p-4 flex items-start gap-3 cursor-pointer hover:bg-white/3 transition-colors group"
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                >
                  {/* Type pill */}
                  <div className="mt-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shrink-0"
                    style={{ background: `${typeCfg.color}20`, color: typeCfg.color, border: `1px solid ${typeCfg.color}40` }}>
                    {typeCfg.label}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white text-sm" data-testid={`text-event-title-${event.id}`}>{event.title}</h4>
                    <p className="text-xs text-white/40 mt-0.5 font-medium">
                      {format(new Date(event.startsAt), "EEE, MMM d · h:mm a")}
                    </p>
                    {event.location && (
                      <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />{event.location}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Attendance mini scoreboard */}
                    <span className="text-xs font-bold" style={{ color: teamColor }}>
                      {event.attendingCount}/{event.totalCount}
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/8" onClick={(e) => { e.stopPropagation(); openEdit(event); }} data-testid={`button-edit-event-${event.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/40 hover:text-red-400 hover:bg-red-400/10" onClick={(e) => handleDelete(event.id, e)} data-testid={`button-delete-event-${event.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-white/20 transition-transform ml-1 ${isExpanded ? "rotate-180" : ""}`} />
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
        <DialogContent className="max-w-md border-white/10" style={{ background: "#161b2e" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">{editingId ? "EDIT EVENT" : "ADD EVENT"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Title</FormLabel>
                  <FormControl><Input placeholder="e.g. Practice" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-event-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-event-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
                      <SelectItem value="practice" className="text-white">Practice</SelectItem>
                      <SelectItem value="game" className="text-white">Game</SelectItem>
                      <SelectItem value="meeting" className="text-white">Meeting</SelectItem>
                      <SelectItem value="other" className="text-white">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Starts At</FormLabel>
                    <FormControl><Input type="datetime-local" className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="input-starts-at" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endsAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Ends At</FormLabel>
                    <FormControl><Input type="datetime-local" className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="input-ends-at" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Location</FormLabel>
                  <FormControl><Input placeholder="Field or venue" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-location" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Notes</FormLabel>
                  <FormControl><Textarea placeholder="Instructions for the team..." className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-event-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full font-semibold rounded-xl h-11" style={{ background: teamColor, color: "white" }} disabled={isPending} data-testid="button-submit-event">
                {isPending ? "Saving..." : editingId ? "Update Event" : "Add to Lineup"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
