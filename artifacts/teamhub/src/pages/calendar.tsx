import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, MapPin,
  X, AlertCircle,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO, format,
} from "date-fns";
import { useListTeams } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

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

export default function CalendarPage() {
  const { t, isRTL, formatTime, formatDateTime, formatMonthYear, language } = useI18n();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

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
    other: "rgba(255,255,255,0.4)",
  };

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

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-label mb-1">{t.calendar.schedule}</p>
          <h1 className="font-display text-4xl text-white">{t.calendar.title.toUpperCase()}</h1>
        </div>

        {/* Team filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTeamId(null)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: selectedTeamId === null ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.05)",
              color: selectedTeamId === null ? "#FF6B35" : "rgba(255,255,255,0.4)",
              border: selectedTeamId === null ? "1px solid rgba(255,107,53,0.4)" : "1px solid rgba(255,255,255,0.08)",
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
                background: selectedTeamId === team.id ? `${team.avatarColor}28` : "rgba(255,255,255,0.05)",
                color: selectedTeamId === team.id ? team.avatarColor : "rgba(255,255,255,0.4)",
                border: selectedTeamId === team.id ? `1px solid ${team.avatarColor}50` : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {team.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-3 rounded-2xl border border-white/6 overflow-hidden"
          style={{ background: "rgba(22,27,46,0.8)" }}>

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
                    className="min-h-[80px] p-1.5 cursor-pointer transition-all border-t border-r border-white/4"
                    style={{
                      background: isSelected ? "rgba(255,107,53,0.08)" : "transparent",
                    }}
                  >
                    {/* Day number — always LTR */}
                    <div className="flex items-center justify-end mb-1">
                      <span
                        className="ltr-num w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: isTodayDay ? "#FF6B35" : isSelected ? "rgba(255,107,53,0.2)" : "transparent",
                          color: isTodayDay ? "white" : isCurrentMonth ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
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
            <div className="rounded-2xl border border-white/6 overflow-hidden"
              style={{ background: "rgba(22,27,46,0.8)" }}>
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
                <button
                  onClick={() => { setSelectedDay(null); setSelectedEvent(null); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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
            <div className="rounded-2xl border border-white/6 overflow-hidden"
              style={{ background: "rgba(22,27,46,0.8)" }}>
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
