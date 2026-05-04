import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, MapPin,
  X, AlertCircle, Plus,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO, format,
} from "date-fns";
import { useListTeams } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/useTheme";

type CalendarEvent = {
  id: number;
  title: string;
  type: "practice" | "game" | "meeting" | "other";
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
  teamId: number;
  teamName: string;
  teamColor: string;
};

const EVENT_TYPES = ["practice", "game", "meeting", "other"] as const;

export default function CalendarPage() {
  const { t, isRTL, formatTime, formatDateTime, formatMonthYear, language } = useI18n();
  const { toast } = useToast();
  const { theme } = useTheme();
  const isLight = theme === "light" || (theme === "system" && !window.matchMedia("(prefers-color-scheme: dark)").matches);
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<string>("practice");
  const [newTeamId, setNewTeamId] = useState<string>("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const { data: teams = [] } = useListTeams();

  const { data: allEvents = [], isLoading, error } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar"],
    queryFn: async () => {
      const res = await fetch("/api/calendar");
      if (!res.ok) throw new Error("Failed to load calendar");
      return res.json();
    },
    staleTime: 30_000,
  });

  const events = useMemo(() => {
    if (selectedTeamId === null) return allEvents;
    return allEvents.filter(e => e.teamId === selectedTeamId);
  }, [allEvents, selectedTeamId]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  function getEventsForDay(day: Date) {
    return events.filter(e => isSameDay(parseISO(e.startsAt), day));
  }

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  const monthLabel = formatMonthYear(currentMonth).toUpperCase();

  const eventTypeLabel = (type: string) => {
    return t.calendar.eventTypes[type as keyof typeof t.calendar.eventTypes] ?? type;
  };

  const typeColor: Record<string, string> = {
    practice: "#4a90e2",
    game: "#FF6B35",
    meeting: "#9b59b6",
    other: "#6b7280",
  };

  function openAddEvent(day?: Date) {
    const d = day ?? selectedDay ?? new Date();
    const dateStr = format(d, "yyyy-MM-dd");
    setNewStartsAt(`${dateStr}T10:00`);
    setNewEndsAt(`${dateStr}T11:00`);
    setNewTitle("");
    setNewType("practice");
    setNewTeamId(teams[0]?.id?.toString() ?? "");
    setNewLocation("");
    setNewNotes("");
    setAddOpen(true);
  }

  async function handleAddEvent() {
    if (!newTitle.trim() || !newTeamId || !newStartsAt) return;
    setAddSaving(true);
    try {
      const res = await fetch(`/api/teams/${newTeamId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          startsAt: new Date(newStartsAt).toISOString(),
          endsAt: newEndsAt ? new Date(newEndsAt).toISOString() : null,
          location: newLocation || null,
          notes: newNotes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setAddOpen(false);
      toast({ title: t.calendar.eventAdded });
    } catch {
      toast({ title: t.calendar.failedAddEvent, variant: "destructive" });
    } finally {
      setAddSaving(false);
    }
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p>{t.common.error}</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-5">

      {/* Add Event Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">{t.calendar.addEvent.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="stat-label text-white/50 block mb-1.5">Title</label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
                placeholder="Event title"
              />
            </div>
            <div dir="ltr">
              <label className="stat-label text-white/50 block mb-1.5">{t.calendar.selectTeam}</label>
              <Select value={newTeamId} onValueChange={setNewTeamId}>
                <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                  <SelectValue placeholder={t.calendar.selectTeam} />
                </SelectTrigger>
                <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={String(team.id)} className="text-white">
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div dir="ltr">
              <label className="stat-label text-white/50 block mb-1.5">Type</label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                  {EVENT_TYPES.map(et => (
                    <SelectItem key={et} value={et} className="text-white">{eventTypeLabel(et)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div dir="ltr">
              <label className="stat-label text-white/50 block mb-1.5">Starts</label>
              <Input
                type="datetime-local"
                value={newStartsAt}
                onChange={e => setNewStartsAt(e.target.value)}
                className="bg-white/6 border-white/10 text-white rounded-xl"
              />
            </div>
            <div dir="ltr">
              <label className="stat-label text-white/50 block mb-1.5">Ends (optional)</label>
              <Input
                type="datetime-local"
                value={newEndsAt}
                onChange={e => setNewEndsAt(e.target.value)}
                className="bg-white/6 border-white/10 text-white rounded-xl"
              />
            </div>
            <div>
              <label className="stat-label text-white/50 block mb-1.5">Location (optional)</label>
              <Input
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
              />
            </div>
            <div>
              <label className="stat-label text-white/50 block mb-1.5">Notes (optional)</label>
              <Input
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl"
              />
            </div>
            <Button
              onClick={handleAddEvent}
              disabled={addSaving || !newTitle.trim() || !newTeamId || !newStartsAt}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11"
            >
              {addSaving ? "Saving..." : t.calendar.addEvent}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-label mb-1">{t.calendar.schedule}</p>
          <h1 className="font-display text-4xl text-white">{t.calendar.title.toUpperCase()}</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => openAddEvent()}
            className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4 me-2" />
            {t.calendar.addEvent}
          </Button>

          {/* Team filter */}
          <button
            onClick={() => setSelectedTeamId(null)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: selectedTeamId === null ? "rgba(255,107,53,0.2)" : isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
              color: selectedTeamId === null ? "#FF6B35" : isLight ? "rgba(10,14,26,0.50)" : "rgba(255,255,255,0.4)",
              border: selectedTeamId === null ? "1px solid rgba(255,107,53,0.4)" : isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {t.common.allSquads}
          </button>
          {teams.map(team => (
            <button
              key={team.id}
              onClick={() => setSelectedTeamId(team.id === selectedTeamId ? null : team.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: selectedTeamId === team.id ? `${team.avatarColor}28` : isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)",
                color: selectedTeamId === team.id ? team.avatarColor : isLight ? "rgba(10,14,26,0.50)" : "rgba(255,255,255,0.4)",
                border: selectedTeamId === team.id ? `1px solid ${team.avatarColor}50` : isLight ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-3 rounded-2xl border border-border overflow-hidden"
          style={{ background: "var(--surface-card)" }}>

          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
            <button
              onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDay(null); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
            >
              <ChevronLeft className="h-4 w-4 flip-rtl" />
            </button>
            <h2 className="font-display text-2xl text-white">
              {monthLabel}
            </h2>
            <button
              onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDay(null); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all"
            >
              <ChevronRight className="h-4 w-4 flip-rtl" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-white/5">
            {t.calendar.weekdays.map((d: string) => (
              <div key={d} className="py-2 text-center stat-label">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const isTodayDay = isToday(day);

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className="min-h-[80px] p-1.5 cursor-pointer transition-all border-t border-r border-white/4 group"
                    style={{
                      background: isSelected ? "rgba(255,107,53,0.08)" : "transparent",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10"
                        onClick={e => { e.stopPropagation(); openAddEvent(day); }}
                        title={t.calendar.addEvent}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                      <span
                        className="ltr-num w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: isTodayDay ? "#FF6B35" : isSelected ? "rgba(255,107,53,0.2)" : "transparent",
                          color: isTodayDay ? "white"
                            : isCurrentMonth
                              ? (isLight ? "rgba(10,14,26,0.82)" : "rgba(255,255,255,0.8)")
                              : (isLight ? "rgba(10,14,26,0.28)" : "rgba(255,255,255,0.2)"),
                          fontSize: isTodayDay ? "14px" : "12px",
                        }}
                      >
                        {format(day, "d")}
                      </span>
                    </div>

                    {/* Event chips */}
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate leading-tight cursor-pointer"
                          style={{
                            background: `${ev.teamColor}28`,
                            color: ev.teamColor,
                            border: `1px solid ${ev.teamColor}40`,
                          }}
                          onClick={e => { e.stopPropagation(); setSelectedEvent(ev); setSelectedDay(day); }}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-white/30 font-bold px-1.5 ltr-num">
                          +{dayEvents.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel: selected day or upcoming */}
        <div className="lg:col-span-1 space-y-4">
          {selectedDay ? (
            <div className="rounded-2xl border border-border overflow-hidden"
              style={{ background: "var(--surface-card)" }}>
              <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                <div>
                  <p className="section-label">
                    {format(selectedDay, "EEE").toUpperCase()}
                  </p>
                  <p className="font-display text-2xl text-white leading-none ltr-num">
                    {language === "en"
                      ? format(selectedDay, "MMM d").toUpperCase()
                      : format(selectedDay, "dd/MM")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openAddEvent(selectedDay)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                    title={t.calendar.addEvent}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setSelectedDay(null); setSelectedEvent(null); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CalIcon className="h-8 w-8 mx-auto text-white/15 mb-2" />
                  <p className="text-xs text-white/30">{t.calendar.noEvents}</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {selectedDayEvents.map(ev => (
                    <button
                      key={ev.id}
                      className="w-full text-start px-4 py-3 hover:bg-white/4 transition-colors"
                      onClick={() => setSelectedEvent(ev)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ev.teamColor }} />
                        <span className="text-xs font-bold"
                          style={{ color: typeColor[ev.type] ?? ev.teamColor }}>
                          {eventTypeLabel(ev.type)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{ev.title}</p>
                      <p className="text-xs text-white/40 mt-0.5 ltr-num">{formatTime(ev.startsAt)}</p>
                      <p className="text-[10px] text-white/25 mt-0.5">{ev.teamName}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Upcoming events sidebar */
            <div className="rounded-2xl border border-border overflow-hidden"
              style={{ background: "var(--surface-card)" }}>
              <div className="px-4 py-3 border-b border-white/6">
                <p className="section-label">{t.calendar.upcoming}</p>
              </div>
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {events
                    .filter(e => new Date(e.startsAt) >= new Date(new Date().setHours(0, 0, 0, 0)))
                    .slice(0, 8)
                    .map(ev => (
                      <button
                        key={ev.id}
                        className="w-full text-start px-4 py-3 hover:bg-white/4 transition-colors"
                        onClick={() => { setSelectedDay(parseISO(ev.startsAt)); setSelectedEvent(ev); }}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ev.teamColor }} />
                          <span className="text-[10px] font-bold" style={{ color: ev.teamColor }}>
                            {ev.teamName}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{ev.title}</p>
                        <p className="text-xs text-white/35 ltr-num">
                          {formatDateTime(ev.startsAt)}
                        </p>
                      </button>
                    ))}
                  {events.filter(e => new Date(e.startsAt) >= new Date()).length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-xs text-white/25">{t.calendar.noUpcoming}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Event detail card */}
          {selectedEvent && (
            <div className="rounded-2xl border overflow-hidden"
              style={{
                background: `${selectedEvent.teamColor}10`,
                borderColor: `${selectedEvent.teamColor}30`,
              }}>
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: `${selectedEvent.teamColor}20` }}>
                <div>
                  <span className="text-[10px] font-bold"
                    style={{ color: typeColor[selectedEvent.type] ?? selectedEvent.teamColor }}>
                    {eventTypeLabel(selectedEvent.type)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="font-display text-xl text-white leading-tight">
                  {selectedEvent.title}
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold"
                    style={{ background: `${selectedEvent.teamColor}30`, color: selectedEvent.teamColor }}>
                    {selectedEvent.teamName.charAt(0)}
                  </div>
                  <span className="text-xs text-white/50">{selectedEvent.teamName}</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <CalIcon className="h-3.5 w-3.5 shrink-0" style={{ color: selectedEvent.teamColor }} />
                    <span className="ltr-num">{formatDateTime(selectedEvent.startsAt)}</span>
                  </div>
                  {selectedEvent.endsAt && (
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <div className="w-3.5 shrink-0" />
                      <span>{t.calendar.until} <span className="ltr-num">{formatTime(selectedEvent.endsAt)}</span></span>
                    </div>
                  )}
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: selectedEvent.teamColor }} />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                  {selectedEvent.notes && (
                    <p className="text-xs text-white/35 italic pt-1 leading-relaxed">{selectedEvent.notes}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
