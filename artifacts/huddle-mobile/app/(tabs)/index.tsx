import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useListTeams, useListEvents, useListTasks, getListEventsQueryKey, getListTasksQueryKey } from "@workspace/api-client-react";
import { CountdownTimer } from "@/components/CountdownTimer";

const GAME_TYPES = ["league_game", "friendly_game", "tournament"];

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card }]}>
      <View style={[statStyles.iconBox, { backgroundColor: color ? `${color}22` : colors.muted }]}>
        <Feather name={icon as any} size={20} color={color ?? colors.primary} />
      </View>
      <Text style={[statStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, padding: 16, gap: 8, minWidth: 100 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 24, fontWeight: "800" },
  label: { fontSize: 12, fontWeight: "500" },
});

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: teams, isLoading: teamsLoading } = useListTeams();
  const firstTeam = teams?.[0];
  const teamId = firstTeam?.id ?? 0;
  const { data: events, isLoading: eventsLoading } = useListEvents(teamId, {
    query: { queryKey: getListEventsQueryKey(teamId), enabled: !!firstTeam },
  });
  const { data: tasks } = useListTasks(teamId, {
    query: { queryKey: getListTasksQueryKey(teamId), enabled: !!firstTeam },
  });

  const now = Date.now();
  const upcoming = (events ?? []).filter((e) => new Date(e.startsAt).getTime() > now);
  const nextGame = upcoming.find((e) => GAME_TYPES.includes(e.type));
  const openTasks = (tasks ?? []).filter((t) => t.status !== "done");

  const isLoading = teamsLoading || eventsLoading;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good game day</Text>
          <Text style={[styles.appName, { color: colors.foreground }]}>CLASIKO</Text>
        </View>
        <View style={[styles.avatarBox, { backgroundColor: colors.primary }]}>
          <Feather name="user" size={20} color="#fff" />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <>
          {nextGame && (
            <View style={[styles.nextGameCard, { backgroundColor: colors.card }]}>
              <View style={styles.ngTop}>
                <View style={[styles.eventTypePill, { backgroundColor: `${colors.primary}22` }]}>
                  <Feather name="shield" size={12} color={colors.primary} />
                  <Text style={[styles.eventTypeText, { color: colors.primary }]}>
                    {nextGame.type === "league_game" ? "League" : nextGame.type === "friendly_game" ? "Friendly" : "Tournament"}
                  </Text>
                </View>
                <Text style={[styles.ngTeam, { color: colors.mutedForeground }]}>
                  {firstTeam?.name}
                </Text>
              </View>
              <Text style={[styles.ngTitle, { color: colors.foreground }]}>{nextGame.title}</Text>
              {nextGame.location ? (
                <View style={styles.locRow}>
                  <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.locText, { color: colors.mutedForeground }]}>{nextGame.location}</Text>
                </View>
              ) : null}
              <View style={styles.countdownWrap}>
                <CountdownTimer targetDate={nextGame.startsAt} />
              </View>
              <TouchableOpacity
                style={[styles.ngBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push(`/team/${firstTeam?.id}`)}
                activeOpacity={0.85}
              >
                <Text style={styles.ngBtnText}>View details</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.statsRow}>
            <StatCard icon="users" value={teams?.length ?? 0} label="Teams" color={colors.info} />
            <StatCard icon="calendar" value={upcoming.length} label="Upcoming" color={colors.primary} />
            <StatCard icon="check-square" value={openTasks.length} label="Open tasks" color={colors.warning} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Teams</Text>
          {(teams ?? []).length === 0 ? (
            <View style={[styles.emptyTeams, { backgroundColor: colors.card }]}>
              <Feather name="users" size={28} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No teams yet</Text>
            </View>
          ) : (
            (teams ?? []).map((team) => (
              <TouchableOpacity
                key={team.id}
                style={[styles.teamRow, { backgroundColor: colors.card }]}
                onPress={() => router.push(`/team/${team.id}`)}
                activeOpacity={0.8}
              >
                <View style={[styles.teamAvatar, { backgroundColor: team.avatarColor ?? colors.primary }]}>
                  <Text style={styles.teamAvatarText}>{team.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.teamInfo}>
                  <Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>
                  <Text style={[styles.teamMeta, { color: colors.mutedForeground }]}>
                    {team.sport}{team.season ? ` · ${team.season}` : ""}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </>
      )}
      <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  greeting: { fontSize: 13, fontWeight: "500" },
  appName: { fontSize: 26, fontWeight: "900", letterSpacing: 3 },
  avatarBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  nextGameCard: { borderRadius: 18, padding: 20, gap: 10 },
  ngTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventTypePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  eventTypeText: { fontSize: 12, fontWeight: "600" },
  ngTeam: { fontSize: 12, fontWeight: "500" },
  ngTitle: { fontSize: 20, fontWeight: "700" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locText: { fontSize: 13 },
  countdownWrap: { paddingVertical: 8 },
  ngBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  ngBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  statsRow: { flexDirection: "row", gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, padding: 14 },
  teamAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  teamAvatarText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 16, fontWeight: "600" },
  teamMeta: { fontSize: 13, marginTop: 2 },
  emptyTeams: { borderRadius: 14, padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },
});
