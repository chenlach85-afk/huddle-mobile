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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Calendar, MapPin, Trash2, Pencil, Users, Check, X, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const TYPE_COLORS: Record<string, string> = {
  practice: "bg-blue-100 text-blue-700 border-blue-200",
  game: "bg-orange-100 text-orange-700 border-orange-200",
  meeting: "bg-purple-100 text-purple-700 border-purple-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
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

function AttendancePanel({ eventId, teamId }: { eventId: number; teamId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: players = [] } = useListPlayers(teamId, { query: { enabled: true, queryKey: [] } });
  const { data: attendance = [] } = useListAttendance(eventId, {
    query: { enabled: !!eventId, queryKey: getListAttendanceQueryKey(eventId) },
  });
  const upsert = useUpsertAttendance();

  function getStatus(playerId: number) {
    return attendance.find(a => a.playerId === playerId)?.status || "no_response";
  }

  function markAttendance(playerId: number, status: "attending" | "not_attending" | "maybe") {
    upsert.mutate({ eventId, data: { playerId, status } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(eventId) }),
      onError: () => toast({ title: "Failed to update attendance", variant: "destructive" }),
    });
  }

  if (players.length === 0) return <p className="text-xs text-muted-foreground">No players on roster yet.</p>;

  return (
    <div className="space-y-2">
      {players.map(player => {
        const status = getStatus(player.id);
        return (
          <div key={player.id} className="flex items-center justify-between" data-testid={`attendance-player-${player.id}`}>
            <span className="text-sm">{player.name}</span>
            <div className="flex gap-1">
              <button
                onClick={() => markAttendance(player.id, "attending")}
                className={`p-1 rounded transition-colors ${status === "attending" ? "bg-green-500 text-white" : "text-muted-foreground hover:text-green-600"}`}
                title="Attending"
                data-testid={`btn-attending-${player.id}`}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => markAttendance(player.id, "maybe")}
                className={`p-1 rounded transition-colors ${status === "maybe" ? "bg-yellow-500 text-white" : "text-muted-foreground hover:text-yellow-600"}`}
                title="Maybe"
                data-testid={`btn-maybe-${player.id}`}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => markAttendance(player.id, "not_attending")}
                className={`p-1 rounded transition-colors ${status === "not_attending" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-red-600"}`}
                title="Not attending"
                data-testid={`btn-not-attending-${player.id}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function EventsTab({ teamId }: { teamId: number }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
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
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); setOpen(false); toast({ title: "Event created" }); },
        onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
      });
    }
  }

  function handleDelete(eventId: number) {
    if (!confirm("Delete this event?")) return;
    deleteEvent.mutate({ eventId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEventsQueryKey(teamId) }); if (selectedEventId === eventId) setSelectedEventId(null); toast({ title: "Event deleted" }); },
      onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
    });
  }

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{events.length} event{events.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={openCreate} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Event
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No events scheduled</p>
            <p className="text-sm text-muted-foreground mb-4">Schedule your first practice or game</p>
            <Button size="sm" onClick={openCreate}>Add Event</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div key={event.id}>
              <Card
                className={`group cursor-pointer transition-all ${selectedEventId === event.id ? "border-primary shadow-sm" : "hover:border-primary/40"}`}
                onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                data-testid={`card-event-${event.id}`}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={`text-xs px-2 py-1 rounded border font-medium mt-0.5 ${TYPE_COLORS[event.type]}`}>
                    {event.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium" data-testid={`text-event-title-${event.id}`}>{event.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.startsAt), "EEE MMM d, yyyy • h:mm a")}
                    </p>
                    {event.location && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{event.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />{event.attendingCount}/{event.totalCount}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(event); }} data-testid={`button-edit-event-${event.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(event.id); }} data-testid={`button-delete-event-${event.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {selectedEventId === event.id && (
                <Card className="border-primary/30 rounded-t-none -mt-1">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm">Attendance</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <AttendancePanel eventId={event.id} teamId={teamId} />
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="e.g. Practice" data-testid="input-event-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-event-type"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="practice">Practice</SelectItem>
                      <SelectItem value="game">Game</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starts At</FormLabel>
                    <FormControl><Input type="datetime-local" data-testid="input-starts-at" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endsAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ends At (optional)</FormLabel>
                    <FormControl><Input type="datetime-local" data-testid="input-ends-at" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (optional)</FormLabel>
                  <FormControl><Input placeholder="Field address or name" data-testid="input-location" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl><Textarea placeholder="Any notes for the team..." data-testid="input-event-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-event">
                {isPending ? "Saving..." : editingId ? "Update Event" : "Create Event"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
