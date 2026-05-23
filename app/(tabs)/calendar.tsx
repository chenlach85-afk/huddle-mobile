import { Feather } from "@expo/vector-icons";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from "date-fns";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useListTeams, useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import { EmptyState } from "@/components/EmptyState";

const EVENT_COLORS: Record<string, string> = {
  training: "#60A5FA", league_game: "#18C6B4", friendly_game: "#F5B700",
  tournament: "#EF4444", celebration: "#22C55E", meeting: "#7C3AED", other: "#73839B",
};
const EVENT_LABELS: Record<string, string> = {
  training: "Training", league_game: "League", friendly_game: "Friendly",
  tournament: "Tournament", celebration: "Celebration", meeting: "Meeting", other: "Other",
};
const EVENT_ICONS: Record<string, string> = {
  training: "activity", league_game: "shield", friendly_game: "flag",
  tournament: "award", celebration: "star", meeting: "users", other: "calendar",
};

const ALL_TYPES = Object.keys(EVENT_LABELS);

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const { data: teams } = useListTeams();
  const firstTeam = teams?.[0];
  const calTeamId = firstTeam?.id ?? 0;
  const { data: events, isLoading } = useListEvents(calTeamId, {
    query: { queryKey: getListEventsQueryKey(calTeamId), enabled: !!firstTeam },
  });

  const filteredEvents = (events ?? []).filter(
    (e: any) => activeFilters.length === 0 || activeFilters.includes(e.type)
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const hasEvent = (day: Date) => filteredEvents.some((e: any) => isSameDay(new Date(e.startsAt), day));
  const dayEvents = selectedDay
    ? filteredEvents.filter((e: any) => isSameDay(new Date(e.startsAt), selectedDay))
    : [];

  const toggleFilter = (type: string) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>Calendar</Text>
      </View>

      {/* Event-type filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {ALL_TYPES.map((type) => {
          const active = activeFilters.includes(type);
          const color = EVENT_COLORS[type];
          return (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, { backgroundColor: active ? color : `${color}22`, borderColor: active ? color : "transparent", borderWidth: 1 }]}
              onPress={() => toggleFilter(type)}
              activeOpacity={0.75}
            >
              <Feather name={EVENT_ICONS[type] as any} size={11} color={active ? "#fff" : color} />
              <Text style={[styles.filterChipText, { color: active ? "#fff" : color }]}>{EVENT_LABELS[type]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.calCard, { backgroundColor: colors.card }]}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.foreground, fontFamily: "Oswald_600SemiBold" }]}>
            {format(currentMonth, "MMMM yyyy")}
          </Text>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} hitSlop={8}>
            <Feather name="chevron-right" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.dayHeaders}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <Text key={d} style={[styles.dayHeader, { color: colors.mutedForeground }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {Array.from({ length: startPad }).map((_, i) => <View key={`pad-${i}`} style={styles.cell} />)}
          {days.map((day) => {
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            const hasDot = hasEvent(day);
            const todayDay = isToday(day);
            const dayEvts = filteredEvents.filter((e: any) => isSameDay(new Date(e.startsAt), day));
            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.cell,
                  isSelected && { backgroundColor: colors.primary, borderRadius: 10 },
                  !isSelected && todayDay && { borderWidth: 1, borderColor: colors.primary, borderRadius: 10 },
                ]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayNum, { color: isSelected ? "#fff" : todayDay ? colors.primary : colors.foreground }]}>
                  {day.getDate()}
                </Text>
                {hasDot && !isSelected && (
                  <View style={styles.dotRow}>
                    {dayEvts.slice(0, 3).map((e: any, idx: number) => (
                      <View key={idx} style={[styles.dot, { backgroundColor: EVENT_COLORS[e.type] ?? colors.primary }]} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {selectedDay ? format(selectedDay, "EEEE, MMM d") : "Events"}
        {activeFilters.length > 0 && (
          <Text style={[styles.filterNote, { color: colors.mutedForeground }]}> (filtered)</Text>
        )}
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : dayEvents.length === 0 ? (
        <EmptyState icon="calendar" title="No events" subtitle="No events for this day" />
      ) : (
        <FlatList
          data={dayEvents}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Platform.OS === "web" ? 34 : 100, gap: 10 }}
          scrollEnabled={!!dayEvents.length}
          renderItem={({ item: event }) => (
            <View style={[styles.eventCard, { backgroundColor: colors.card }]}>
              <View style={[styles.eventAccent, { backgroundColor: EVENT_COLORS[event.type] ?? colors.primary }]} />
              <View style={styles.eventBody}>
                <View style={styles.eventTop}>
                  <View style={[styles.typePill, { backgroundColor: `${EVENT_COLORS[event.type] ?? colors.primary}22` }]}>
                    <Feather name={EVENT_ICONS[event.type] as any ?? "calendar"} size={11} color={EVENT_COLORS[event.type] ?? colors.primary} />
                    <Text style={[styles.typeText, { color: EVENT_COLORS[event.type] ?? colors.primary }]}>
                      {EVENT_LABELS[event.type] ?? "Event"}
                    </Text>
                  </View>
                  <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>
                    {format(new Date(event.startsAt), "h:mm a")}
                  </Text>
                </View>
                <Text style={[styles.eventTitle, { color: colors.foreground }]}>{event.title}</Text>
                {event.location ? (
                  <View style={styles.locRow}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.locText, { color: colors.mutedForeground }]}>{event.location}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 32 },
  filterRow: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipText: { fontSize: 12, fontWeight: "700" },
  calCard: { marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 14 },
  monthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  monthLabel: { fontSize: 17 },
  dayHeaders: { flexDirection: "row", marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayNum: { fontSize: 14, fontWeight: "500" },
  dotRow: { flexDirection: "row", gap: 2, marginTop: 1 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  filterNote: { fontSize: 14, fontWeight: "400" },
  sectionTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8 },
  eventCard: { flexDirection: "row", borderRadius: 14, overflow: "hidden" },
  eventAccent: { width: 4 },
  eventBody: { flex: 1, padding: 14, gap: 6 },
  eventTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  typeText: { fontSize: 11, fontWeight: "700" },
  eventTime: { fontSize: 12 },
  eventTitle: { fontSize: 16, fontWeight: "600" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locText: { fontSize: 12 },
});
