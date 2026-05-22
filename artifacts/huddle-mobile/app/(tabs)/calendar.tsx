import { Feather } from "@expo/vector-icons";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from "date-fns";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useListTeams, useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import { EmptyState } from "@/components/EmptyState";

const EVENT_COLORS: Record<string, string> = {
  training: "#4a90e2",
  league_game: "#ff6b1a",
  friendly_game: "#f7b538",
  tournament: "#e74c3c",
  celebration: "#2ecc71",
  meeting: "#9b59b6",
  other: "#7a8399",
};

const EVENT_LABELS: Record<string, string> = {
  training: "Training",
  league_game: "League",
  friendly_game: "Friendly",
  tournament: "Tournament",
  celebration: "Celebration",
  meeting: "Meeting",
  other: "Other",
};

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const { data: teams } = useListTeams();
  const firstTeam = teams?.[0];
  const calTeamId = firstTeam?.id ?? 0;
  const { data: events, isLoading } = useListEvents(calTeamId, {
    query: { queryKey: getListEventsQueryKey(calTeamId), enabled: !!firstTeam },
  });

  const allEvents = events ?? [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const hasEvent = (day: Date) => allEvents.some((e: any) => isSameDay(new Date(e.startsAt), day));
  const dayEvents = selectedDay
    ? allEvents.filter((e: any) => isSameDay(new Date(e.startsAt), selectedDay))
    : [];

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Calendar</Text>
      </View>

      <View style={[styles.calCard, { backgroundColor: colors.card }]}>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={prevMonth} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.foreground }]}>{format(currentMonth, "MMMM yyyy")}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={8}>
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
                <Text style={[
                  styles.dayNum,
                  { color: isSelected ? "#fff" : todayDay ? colors.primary : colors.foreground },
                ]}>
                  {day.getDate()}
                </Text>
                {hasDot && !isSelected && (
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {selectedDay ? format(selectedDay, "EEEE, MMM d") : "Events"}
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : dayEvents.length === 0 ? (
        <EmptyState icon="calendar" title="No events" subtitle="No events scheduled for this day" />
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
  header: { paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "800" },
  calCard: { marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16 },
  monthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  monthLabel: { fontSize: 17, fontWeight: "700" },
  dayHeaders: { flexDirection: "row", marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayNum: { fontSize: 14, fontWeight: "500" },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8 },
  eventCard: { flexDirection: "row", borderRadius: 14, overflow: "hidden" },
  eventAccent: { width: 4 },
  eventBody: { flex: 1, padding: 14, gap: 6 },
  eventTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  typeText: { fontSize: 11, fontWeight: "700" },
  eventTime: { fontSize: 12 },
  eventTitle: { fontSize: 16, fontWeight: "600" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locText: { fontSize: 12 },
});
