import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  useGetTeam,
  useListEvents,
  useListTasks,
  useListMessages,
  useListAlbums,
  useListTeamDocs,
  useCreateMessage,
  useUpdateTask,
  useCreateTask,
  useListAttendance,
  useUpsertAttendance,
} from "@workspace/api-client-react";
import { useRoster, useCreateRosterMember, useAppUser, apiFetch, RosterMember } from "@/lib/useApi";
import { StatusBadge } from "@/components/StatusBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { EmptyState } from "@/components/EmptyState";
import type { Event } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Tab = "squad" | "next-game" | "schedule" | "tasks" | "messages" | "files";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "squad",     label: "Squad",     icon: "users" },
  { key: "next-game", label: "Next Game", icon: "shield" },
  { key: "schedule",  label: "Schedule",  icon: "calendar" },
  { key: "tasks",     label: "Tasks",     icon: "check-square" },
  { key: "messages",  label: "Messages",  icon: "message-circle" },
  { key: "files",     label: "Files",     icon: "folder" },
];

const EVENT_COLORS: Record<string, string> = {
  training: "#4a90e2", league_game: "#ff6b1a", friendly_game: "#f7b538",
  tournament: "#e74c3c", celebration: "#2ecc71", meeting: "#9b59b6", other: "#7a8399",
};
const EVENT_LABELS: Record<string, string> = {
  training: "Training", league_game: "League", friendly_game: "Friendly",
  tournament: "Tournament", celebration: "Celebration", meeting: "Meeting", other: "Other",
};
const EVENT_ICONS: Record<string, string> = {
  training: "activity", league_game: "shield", friendly_game: "flag",
  tournament: "award", celebration: "star", meeting: "users", other: "calendar",
};
const GAME_TYPES = ["league_game", "friendly_game", "tournament"];
const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;

/* ─────── ATT helpers ─────── */
const ATT_STATUS_CYCLE = ["attending", "maybe", "not_attending", "no_response"] as const;
type AttStatus = typeof ATT_STATUS_CYCLE[number];
const ATT_CONFIG: Record<AttStatus, { color: string; icon: string; label: string }> = {
  attending:     { color: "#2ecc71", icon: "check-circle", label: "Going" },
  maybe:         { color: "#f7b538", icon: "help-circle",  label: "Maybe" },
  not_attending: { color: "#ef3b3b", icon: "x-circle",     label: "Can't Go" },
  no_response:   { color: "#7a8399", icon: "clock",        label: "No Reply" },
};

/* ─────── Shared text input helper ─────── */
function Inp({ value, onChange, ph, kb, style }: { value: string; onChange: (s: string) => void; ph: string; kb?: any; style?: any }) {
  const colors = useColors();
  return (
    <TextInput
      style={[mStyles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }, style]}
      placeholder={ph} placeholderTextColor={colors.mutedForeground} value={value} onChangeText={onChange}
      keyboardType={kb} autoCapitalize="none"
    />
  );
}

/* ─────── Player Form (shared by Add + Edit) ─────── */
function PlayerForm({
  initial, onSubmit, isPending, submitLabel,
}: {
  initial?: Partial<RosterMember>;
  onSubmit: (data: any) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const colors = useColors();
  const [name, setName] = useState(initial?.placeholderFullName ?? "");
  const [jersey, setJersey] = useState(initial?.jerseyNumber ?? "");
  const [position, setPosition] = useState(initial?.position ?? "");
  const [email, setEmail] = useState(initial?.placeholderEmail ?? "");
  const [phone, setPhone] = useState(initial?.placeholderPhone ?? "");

  const canSubmit = name.trim().length > 0;
  return (
    <>
      <Inp value={name} onChange={setName} ph="Full name *" />
      <Inp value={jersey} onChange={setJersey} ph="Jersey number" kb="number-pad" />
      <Inp value={position} onChange={setPosition} ph="Position (e.g. Forward)" />
      <Inp value={email} onChange={setEmail} ph="Email (optional)" kb="email-address" />
      <Inp value={phone} onChange={setPhone} ph="Phone / WhatsApp (optional)" kb="phone-pad" />
      <TouchableOpacity
        style={[mStyles.btn, { backgroundColor: colors.primary }, (!canSubmit || isPending) && { opacity: 0.55 }]}
        onPress={() => onSubmit({ placeholderFullName: name.trim(), jerseyNumber: jersey || undefined, position: position || undefined, placeholderEmail: email || undefined, placeholderPhone: phone || undefined })}
        disabled={!canSubmit || isPending}
        activeOpacity={0.85}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.btnText}>{submitLabel}</Text>}
      </TouchableOpacity>
    </>
  );
}

/* ─────── Add Player Modal ─────── */
function AddPlayerModal({ teamId, visible, onClose }: { teamId: number; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { mutate, isPending } = useCreateRosterMember(teamId);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[mStyles.root, { backgroundColor: colors.background }]}>
        <View style={mStyles.header}>
          <Text style={[mStyles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>Add Player</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        <PlayerForm
          onSubmit={(data) => mutate(data, {
            onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onClose(); },
            onError: () => Alert.alert("Error", "Could not add player"),
          })}
          isPending={isPending}
          submitLabel="Add Player"
        />
      </View>
    </Modal>
  );
}

/* ─────── Edit Player Modal ─────── */
function EditPlayerModal({ teamId, member, visible, onClose }: { teamId: number; member: RosterMember | null; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  if (!member) return null;

  const handleSubmit = async (data: any) => {
    setIsPending(true);
    try {
      await apiFetch(`/api/teams/${teamId}/roster/${member.id}`, { method: "PATCH", body: JSON.stringify(data) });
      qc.invalidateQueries({ queryKey: ["roster", teamId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert("Error", "Could not update player");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[mStyles.root, { backgroundColor: colors.background }]}>
        <View style={mStyles.header}>
          <Text style={[mStyles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>Edit Player</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        <PlayerForm initial={member} onSubmit={handleSubmit} isPending={isPending} submitLabel="Save Changes" />
      </View>
    </Modal>
  );
}

/* ─────── Add Task Modal ─────── */
function AddTaskModal({ teamId, visible, onClose, roster }: { teamId: number; visible: boolean; onClose: () => void; roster: RosterMember[] }) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<typeof PRIORITY_OPTIONS[number]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const { mutate, isPending } = useCreateTask();

  const submit = () => {
    if (!title.trim()) return;
    mutate(
      { teamId, data: { title: title.trim(), priority, dueDate: dueDate || undefined, assignedToPlayerId: assigneeId ?? undefined } },
      {
        onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTitle(""); setPriority("medium"); setDueDate(""); setAssigneeId(null); onClose(); },
        onError: () => Alert.alert("Error", "Could not create task"),
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <ScrollView style={[mStyles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 24, gap: 0 }}>
        <View style={mStyles.header}>
          <Text style={[mStyles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>New Task</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        <Inp value={title} onChange={setTitle} ph="Task title *" style={{ marginBottom: 14 }} />
        <Text style={[mStyles.label, { color: colors.mutedForeground }]}>Priority</Text>
        <View style={mStyles.chips}>
          {PRIORITY_OPTIONS.map((p) => (
            <TouchableOpacity key={p} style={[mStyles.chip, { backgroundColor: priority === p ? colors.primary : colors.muted }]} onPress={() => setPriority(p)}>
              <Text style={[mStyles.chipText, { color: priority === p ? "#fff" : colors.mutedForeground }]}>{p[0].toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Inp value={dueDate} onChange={setDueDate} ph="Due date (YYYY-MM-DD)" style={{ marginBottom: 14 }} />

        {roster.length > 0 && (
          <>
            <Text style={[mStyles.label, { color: colors.mutedForeground }]}>Assign to player (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[mStyles.chip, { backgroundColor: assigneeId === null ? colors.primary : colors.muted }]} onPress={() => setAssigneeId(null)}>
                  <Text style={[mStyles.chipText, { color: assigneeId === null ? "#fff" : colors.mutedForeground }]}>None</Text>
                </TouchableOpacity>
                {roster.map((m) => (
                  <TouchableOpacity key={m.id} style={[mStyles.chip, { backgroundColor: assigneeId === m.id ? colors.primary : colors.muted }]} onPress={() => setAssigneeId(m.id)}>
                    <Text style={[mStyles.chipText, { color: assigneeId === m.id ? "#fff" : colors.mutedForeground }]}>
                      {m.placeholderFullName?.split(" ")[0] ?? `#${m.jerseyNumber}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <TouchableOpacity
          style={[mStyles.btn, { backgroundColor: colors.primary, marginTop: 8 }, (!title.trim() || isPending) && { opacity: 0.55 }]}
          onPress={submit} disabled={isPending || !title.trim()} activeOpacity={0.85}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.btnText}>Create Task</Text>}
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 26 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  input: { height: 52, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, marginBottom: 14 },
  chips: { flexDirection: "row", gap: 10, marginBottom: 14 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  chipText: { fontSize: 14, fontWeight: "600" },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

/* ─────── Event Detail + Attendance Modal ─────── */
function EventDetailModal({
  event, visible, onClose, roster,
}: { event: Event | null; visible: boolean; onClose: () => void; roster: RosterMember[] }) {
  const colors = useColors();
  const { data: attendance, refetch } = useListAttendance(event?.id ?? 0);
  const { mutate: upsertAtt } = useUpsertAttendance();

  if (!event) return null;

  const att = attendance ?? [];
  const accentColor = EVENT_COLORS[event.type] ?? colors.primary;

  const getPlayerStatus = (playerId: number): AttStatus =>
    (att.find((a) => a.playerId === playerId)?.status as AttStatus) ?? "no_response";

  const cycleStatus = (playerId: number) => {
    const cur = getPlayerStatus(playerId);
    const nextIdx = (ATT_STATUS_CYCLE.indexOf(cur) + 1) % ATT_STATUS_CYCLE.length;
    upsertAtt(
      { eventId: event.id, data: { playerId, status: ATT_STATUS_CYCLE[nextIdx] } },
      { onSuccess: () => refetch() }
    );
    Haptics.selectionAsync();
  };

  const counts = {
    attending:     att.filter((a) => a.status === "attending").length,
    maybe:         att.filter((a) => a.status === "maybe").length,
    not_attending: att.filter((a) => a.status === "not_attending").length,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <ScrollView style={[evStyles.root, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={evStyles.header}>
          <View style={[evStyles.typePill, { backgroundColor: `${accentColor}22` }]}>
            <Feather name={EVENT_ICONS[event.type] as any ?? "calendar"} size={12} color={accentColor} />
            <Text style={[evStyles.typeText, { color: accentColor }]}>{EVENT_LABELS[event.type] ?? "Event"}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <Text style={[evStyles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>{event.title}</Text>
        <View style={evStyles.metaRow}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[evStyles.meta, { color: colors.mutedForeground }]}>
            {format(new Date(event.startsAt), "EEEE, MMM d · h:mm a")}
          </Text>
        </View>
        {event.location ? (
          <View style={evStyles.metaRow}>
            <Feather name="map-pin" size={14} color={colors.mutedForeground} />
            <Text style={[evStyles.meta, { color: colors.mutedForeground }]}>{event.location}</Text>
          </View>
        ) : null}
        {event.notes ? (
          <Text style={[evStyles.notes, { color: colors.foreground, backgroundColor: colors.muted }]}>{event.notes}</Text>
        ) : null}

        <Text style={[evStyles.sectionTitle, { color: colors.mutedForeground }]}>ATTENDANCE SUMMARY</Text>
        <View style={evStyles.countRow}>
          {[
            { count: counts.attending,     label: "Going",    color: "#2ecc71", bg: "rgba(46,204,113,0.12)" },
            { count: counts.maybe,         label: "Maybe",    color: "#f7b538", bg: "rgba(247,181,56,0.12)" },
            { count: counts.not_attending, label: "Can't Go", color: "#ef3b3b", bg: "rgba(239,59,59,0.12)" },
          ].map(({ count, label, color, bg }) => (
            <View key={label} style={[evStyles.countCard, { backgroundColor: bg }]}>
              <Text style={[evStyles.countNum, { color }]}>{count}</Text>
              <Text style={[evStyles.countLabel, { color }]}>{label}</Text>
            </View>
          ))}
        </View>

        {roster.length > 0 && (
          <>
            <Text style={[evStyles.sectionTitle, { color: colors.mutedForeground }]}>PLAYER RSVP — tap to cycle</Text>
            <View style={{ gap: 8 }}>
              {roster.map((member) => {
                const status = getPlayerStatus(member.id);
                const cfg = ATT_CONFIG[status];
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[evStyles.playerRow, { backgroundColor: colors.card }]}
                    onPress={() => cycleStatus(member.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[evStyles.miniJersey, { backgroundColor: `${colors.primary}22` }]}>
                      <Text style={[evStyles.miniNum, { color: colors.primary }]}>{member.jerseyNumber ?? "#"}</Text>
                    </View>
                    <Text style={[evStyles.playerName, { color: colors.foreground }]} numberOfLines={1}>
                      {member.placeholderFullName ?? "Player"}
                    </Text>
                    <View style={[evStyles.statusChip, { backgroundColor: `${cfg.color}18` }]}>
                      <Feather name={cfg.icon as any} size={13} color={cfg.color} />
                      <Text style={[evStyles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </Modal>
  );
}

const evStyles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  typePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typeText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 28, marginBottom: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  meta: { fontSize: 14 },
  notes: { padding: 14, borderRadius: 12, fontSize: 14, lineHeight: 20, marginTop: 10, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  countRow: { flexDirection: "row", gap: 10 },
  countCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", gap: 4 },
  countNum: { fontSize: 28, fontWeight: "800" },
  countLabel: { fontSize: 11, fontWeight: "600" },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
  miniJersey: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  miniNum: { fontSize: 16, fontWeight: "700" },
  playerName: { flex: 1, fontSize: 14, fontWeight: "500" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },
});

/* ─────── Squad Tab ─────── */
function SquadTab({ teamId, isCoach }: { teamId: number; isCoach: boolean }) {
  const colors = useColors();
  const { data: roster, isLoading, refetch } = useRoster(teamId);
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<RosterMember | null>(null);

  const removeMember = (member: RosterMember) => {
    Alert.alert("Remove player", `Remove ${member.placeholderFullName ?? "this player"}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/teams/${teamId}/roster/${member.id}`, { method: "DELETE" });
            qc.invalidateQueries({ queryKey: ["roster", teamId] });
          } catch {
            Alert.alert("Error", "Could not remove player");
          }
        },
      },
    ]);
  };

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const members = roster ?? [];

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={members}
        keyExtractor={(m) => String(m.id)}
        onRefresh={refetch}
        refreshing={isLoading}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        scrollEnabled
        ListEmptyComponent={<EmptyState icon="users" title="No players yet" subtitle={isCoach ? "Tap + to add your first player" : "No players on this team"} />}
        renderItem={({ item: member }) => (
          <View style={[sqStyles.card, { backgroundColor: colors.card }]}>
            <View style={[sqStyles.jersey, { backgroundColor: `${colors.primary}22` }]}>
              <Text style={[sqStyles.jerseyNum, { color: colors.primary, fontFamily: "BebasNeue_400Regular" }]}>
                {member.jerseyNumber ?? "#"}
              </Text>
            </View>
            <View style={sqStyles.info}>
              <Text style={[sqStyles.name, { color: colors.foreground }]}>{member.placeholderFullName ?? "Player"}</Text>
              {member.position ? <Text style={[sqStyles.pos, { color: colors.mutedForeground }]}>{member.position}</Text> : null}
            </View>
            <View style={sqStyles.right}>
              <StatusBadge status={(member.status as any) ?? "active"} small />
              {member.placeholderPhone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${member.placeholderPhone?.replace(/\D/g, "")}`)} hitSlop={8}>
                  <Feather name="message-circle" size={18} color="#2ecc71" />
                </TouchableOpacity>
              ) : null}
              {isCoach && (
                <TouchableOpacity onPress={() => {
                  Alert.alert(member.placeholderFullName ?? "Player", "What would you like to do?", [
                    { text: "Edit", onPress: () => setEditMember(member) },
                    { text: "Remove", style: "destructive", onPress: () => removeMember(member) },
                    { text: "Cancel", style: "cancel" },
                  ]);
                }} hitSlop={8}>
                  <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
      {isCoach && (
        <TouchableOpacity style={[sqStyles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Feather name="user-plus" size={22} color="#fff" />
        </TouchableOpacity>
      )}
      <AddPlayerModal teamId={teamId} visible={showAdd} onClose={() => setShowAdd(false)} />
      <EditPlayerModal teamId={teamId} member={editMember} visible={!!editMember} onClose={() => setEditMember(null)} />
    </View>
  );
}

const sqStyles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14 },
  jersey: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  jerseyNum: { fontSize: 20 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  pos: { fontSize: 12, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  fab: { position: "absolute", bottom: 24, right: 20, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
});

/* ─────── Next Game Tab ─────── */
function NextGameTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: events, isLoading } = useListEvents(teamId);
  const { data: roster } = useRoster(teamId);

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  const now = Date.now();
  const nextGame = (events ?? [])
    .filter((e) => GAME_TYPES.includes(e.type) && new Date(e.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  if (!nextGame) return <EmptyState icon="shield" title="No upcoming games" subtitle="No league, friendly or tournament events scheduled" />;

  const accentColor = EVENT_COLORS[nextGame.type] ?? colors.primary;
  return <NextGameDetail event={nextGame} roster={roster ?? []} accentColor={accentColor} />;
}

function NextGameDetail({ event, roster, accentColor }: { event: Event; roster: RosterMember[]; accentColor: string }) {
  const colors = useColors();
  const { data: attendance, refetch } = useListAttendance(event.id);
  const { mutate: upsertAtt } = useUpsertAttendance();

  const att = attendance ?? [];

  const getPlayerStatus = (playerId: number): AttStatus =>
    (att.find((a) => a.playerId === playerId)?.status as AttStatus) ?? "no_response";

  const cycleStatus = (playerId: number) => {
    const cur = getPlayerStatus(playerId);
    const nextIdx = (ATT_STATUS_CYCLE.indexOf(cur) + 1) % ATT_STATUS_CYCLE.length;
    upsertAtt({ eventId: event.id, data: { playerId, status: ATT_STATUS_CYCLE[nextIdx] } }, { onSuccess: () => refetch() });
    Haptics.selectionAsync();
  };

  const confirmed      = att.filter((a) => a.status === "attending").length;
  const maybe          = att.filter((a) => a.status === "maybe").length;
  const cantMake       = att.filter((a) => a.status === "not_attending").length;
  const noResponseRoster = roster.filter((m) => !att.find((a) => a.playerId === m.id));
  const noResponseCount  = noResponseRoster.length;
  const whatsappNumbers  = noResponseRoster.flatMap((m) =>
    m.placeholderPhone ? [m.placeholderPhone.replace(/\D/g, "")] : []
  );

  const sendWhatsapp = () => {
    if (whatsappNumbers.length === 0) { Alert.alert("No contacts", "No phone numbers for non-responders"); return; }
    const msg = encodeURIComponent(`Reminder: "${event.title}" on ${format(new Date(event.startsAt), "MMM d")} at ${format(new Date(event.startsAt), "h:mm a")}. Please let us know if you're coming!`);
    Linking.openURL(`https://wa.me/${whatsappNumbers[0]}?text=${msg}`);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>
      <View style={[ngStyles.heroCard, { backgroundColor: colors.card, borderLeftColor: accentColor }]}>
        <View style={ngStyles.heroTop}>
          <View style={[ngStyles.typePill, { backgroundColor: `${accentColor}22` }]}>
            <Feather name={EVENT_ICONS[event.type] as any ?? "shield"} size={12} color={accentColor} />
            <Text style={[ngStyles.typePillText, { color: accentColor }]}>{EVENT_LABELS[event.type]}</Text>
          </View>
          <Text style={[ngStyles.dateText, { color: colors.mutedForeground }]}>{format(new Date(event.startsAt), "EEEE, MMM d")}</Text>
        </View>
        <Text style={[ngStyles.eventTitle, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>{event.title}</Text>
        {event.location ? (
          <View style={ngStyles.locRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[ngStyles.locText, { color: colors.mutedForeground }]}>{event.location}</Text>
          </View>
        ) : null}
        <View style={{ alignItems: "center", paddingVertical: 16 }}>
          <Text style={[ngStyles.countdownLabel, { color: colors.mutedForeground }]}>KICKOFF IN</Text>
          <CountdownTimer targetDate={event.startsAt} />
        </View>
      </View>

      <Text style={[ngStyles.sectionTitle, { color: colors.mutedForeground }]}>SQUAD AVAILABILITY</Text>
      <View style={ngStyles.attGrid}>
        {[
          { count: confirmed,     label: "Confirmed",    color: "#2ecc71", icon: "check-circle" },
          { count: maybe,         label: "Maybe",        color: "#f7b538", icon: "help-circle" },
          { count: cantMake,      label: "Can't Make It",color: "#ef3b3b", icon: "x-circle" },
          { count: noResponseCount, label: "No Response", color: colors.mutedForeground, icon: "clock" },
        ].map(({ count, label, color, icon }) => (
          <View key={label} style={[ngStyles.attCard, { backgroundColor: colors.card }]}>
            <Feather name={icon as any} size={20} color={color} />
            <Text style={[ngStyles.attNum, { color }]}>{count}</Text>
            <Text style={[ngStyles.attLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      {roster.length > 0 && (
        <>
          <Text style={[ngStyles.sectionTitle, { color: colors.mutedForeground }]}>PLAYER RSVP — tap to cycle</Text>
          {roster.map((member) => {
            const status = getPlayerStatus(member.id);
            const cfg = ATT_CONFIG[status];
            return (
              <TouchableOpacity key={member.id}
                style={[ngStyles.playerRsvpRow, { backgroundColor: colors.card }]}
                onPress={() => cycleStatus(member.id)} activeOpacity={0.75}
              >
                <View style={[ngStyles.miniJersey, { backgroundColor: `${colors.primary}22` }]}>
                  <Text style={[ngStyles.miniJerseyNum, { color: colors.primary }]}>{member.jerseyNumber ?? "#"}</Text>
                </View>
                <Text style={[ngStyles.playerName, { color: colors.foreground }]} numberOfLines={1}>
                  {member.placeholderFullName ?? "Player"}
                </Text>
                <View style={[ngStyles.statusChip, { backgroundColor: `${cfg.color}18` }]}>
                  <Feather name={cfg.icon as any} size={13} color={cfg.color} />
                  <Text style={[ngStyles.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {noResponseRoster.length > 0 && (
        <TouchableOpacity
          style={[ngStyles.whatsappBtn, { backgroundColor: "#2ecc7118", borderColor: "#2ecc7144", borderWidth: 1 }]}
          onPress={sendWhatsapp} activeOpacity={0.8}
        >
          <Feather name="message-circle" size={20} color="#2ecc71" />
          <Text style={[ngStyles.whatsappText, { color: "#2ecc71" }]}>
            WhatsApp reminder to {noResponseRoster.length} non-responder{noResponseRoster.length !== 1 ? "s" : ""}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const ngStyles = StyleSheet.create({
  heroCard:       { borderRadius: 18, padding: 20, gap: 8, borderLeftWidth: 4 },
  heroTop:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typePill:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typePillText:   { fontSize: 12, fontWeight: "700" },
  dateText:       { fontSize: 13 },
  eventTitle:     { fontSize: 26, lineHeight: 30 },
  locRow:         { flexDirection: "row", alignItems: "center", gap: 5 },
  locText:        { fontSize: 13 },
  countdownLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  sectionTitle:   { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  attGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  attCard:        { width: "47%", borderRadius: 14, padding: 16, alignItems: "center", gap: 6 },
  attNum:         { fontSize: 28, fontWeight: "800" },
  attLabel:       { fontSize: 12, fontWeight: "500", textAlign: "center" },
  playerRsvpRow:  { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12 },
  miniJersey:     { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  miniJerseyNum:  { fontSize: 16, fontWeight: "700" },
  playerName:     { flex: 1, fontSize: 14, fontWeight: "500" },
  statusChip:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusChipText: { fontSize: 12, fontWeight: "600" },
  whatsappBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14 },
  whatsappText:   { fontSize: 14, fontWeight: "700" },
});

/* ─────── Schedule Tab ─────── */
function ScheduleTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: events, isLoading } = useListEvents(teamId);
  const { data: roster } = useRoster(teamId);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  const now = Date.now();
  const upcoming = (events ?? [])
    .filter((e) => new Date(e.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  if (!upcoming.length) return <EmptyState icon="calendar" title="No upcoming events" />;

  // Group by month
  const grouped: Record<string, Event[]> = {};
  for (const e of upcoming) {
    const key = format(new Date(e.startsAt), "MMMM yyyy");
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  }
  const sections = Object.entries(grouped).map(([title, data]) => ({ title, data }));

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[schStyles.monthHeader, { color: colors.mutedForeground }]}>{section.title.toUpperCase()}</Text>
        )}
        renderItem={({ item: event }) => (
          <TouchableOpacity style={[schStyles.card, { backgroundColor: colors.card }]} onPress={() => setSelectedEvent(event)} activeOpacity={0.85}>
            <View style={[schStyles.accent, { backgroundColor: EVENT_COLORS[event.type] ?? colors.primary }]} />
            <View style={schStyles.body}>
              <View style={schStyles.top}>
                <View style={[schStyles.pill, { backgroundColor: `${EVENT_COLORS[event.type] ?? colors.primary}22` }]}>
                  <Feather name={EVENT_ICONS[event.type] as any ?? "calendar"} size={11} color={EVENT_COLORS[event.type] ?? colors.primary} />
                  <Text style={[schStyles.pillText, { color: EVENT_COLORS[event.type] ?? colors.primary }]}>{EVENT_LABELS[event.type] ?? "Event"}</Text>
                </View>
                <Text style={[schStyles.date, { color: colors.mutedForeground }]}>{format(new Date(event.startsAt), "MMM d · h:mm a")}</Text>
              </View>
              <Text style={[schStyles.title, { color: colors.foreground }]}>{event.title}</Text>
              {event.location ? (
                <View style={schStyles.loc}>
                  <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                  <Text style={[schStyles.locText, { color: colors.mutedForeground }]}>{event.location}</Text>
                </View>
              ) : null}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
      <EventDetailModal
        event={selectedEvent}
        visible={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        roster={roster ?? []}
      />
    </View>
  );
}

const schStyles = StyleSheet.create({
  monthHeader: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 16, marginBottom: 10 },
  card: { flexDirection: "row", borderRadius: 14, overflow: "hidden" },
  accent: { width: 4 },
  body: { flex: 1, padding: 14, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: "700" },
  date: { fontSize: 12 },
  title: { fontSize: 15, fontWeight: "600" },
  loc: { flexDirection: "row", alignItems: "center", gap: 4 },
  locText: { fontSize: 12 },
});

/* ─────── Tasks Tab ─────── */
function TasksTab({ teamId, isCoach, roster }: { teamId: number; isCoach: boolean; roster: RosterMember[] }) {
  const colors = useColors();
  const { data: tasks, isLoading, refetch } = useListTasks(teamId);
  const { mutate: updateTask } = useUpdateTask();
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={tasks ?? []}
        keyExtractor={(t) => String(t.id)}
        onRefresh={refetch}
        refreshing={isLoading}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        scrollEnabled
        ListEmptyComponent={<EmptyState icon="check-square" title="No tasks" subtitle={isCoach ? "Tap + to create a task" : "No tasks assigned"} />}
        renderItem={({ item: task }) => {
          const assignee = roster.find((m) => m.id === task.assignedToPlayerId);
          return (
            <View style={[tkStyles.card, { backgroundColor: colors.card }]}>
              <TouchableOpacity
                style={[tkStyles.check, task.status === "done" && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => { updateTask({ taskId: task.id, data: { status: task.status === "done" ? "pending" : "done" as any } }, { onSuccess: () => refetch() }); Haptics.selectionAsync(); }}
                hitSlop={8}
              >
                {task.status === "done" && <Feather name="check" size={12} color="#fff" />}
              </TouchableOpacity>
              <View style={tkStyles.info}>
                <Text style={[tkStyles.title, { color: colors.foreground, textDecorationLine: task.status === "done" ? "line-through" : "none" }]}>
                  {task.title}
                </Text>
                <View style={tkStyles.meta}>
                  {task.dueDate ? <Text style={[tkStyles.due, { color: colors.mutedForeground }]}>Due {task.dueDate}</Text> : null}
                  {assignee ? <Text style={[tkStyles.assignee, { color: colors.primary }]}>→ {assignee.placeholderFullName?.split(" ")[0]}</Text> : null}
                </View>
              </View>
              <StatusBadge status={(task.priority as any) ?? "medium"} small />
            </View>
          );
        }}
      />
      {isCoach && (
        <TouchableOpacity style={[sqStyles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Feather name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      )}
      <AddTaskModal teamId={teamId} visible={showAdd} onClose={() => setShowAdd(false)} roster={roster} />
    </View>
  );
}

const tkStyles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: "#7a8399", alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "500" },
  meta: { flexDirection: "row", gap: 10, marginTop: 2 },
  due: { fontSize: 12 },
  assignee: { fontSize: 12, fontWeight: "600" },
});

/* ─────── Messages Tab ─────── */
function MessagesTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: messages, isLoading, refetch } = useListMessages(teamId);
  const { mutate: sendMsg, isPending } = useCreateMessage();
  const [text, setText] = useState("");
  const insets = useSafeAreaInsets();

  const send = () => {
    if (!text.trim()) return;
    sendMsg({ teamId, data: { content: text.trim(), senderName: "Coach", senderRole: "coach" as "coach" } }, {
      onSuccess: () => { setText(""); Haptics.selectionAsync(); refetch(); },
    });
  };

  const msgs = (messages ?? []).slice().reverse();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={msgs}
          keyExtractor={(m) => String(m.id)}
          inverted
          contentContainerStyle={{ padding: 16, gap: 10 }}
          scrollEnabled={!!msgs.length}
          ListEmptyComponent={<EmptyState icon="message-circle" title="No messages" subtitle="Be the first to post" />}
          renderItem={({ item: msg }) => (
            <View style={[msgStyles.bubble, { backgroundColor: colors.card }]}>
              {msg.pinned && (
                <View style={msgStyles.pinnedRow}>
                  <Feather name="bookmark" size={11} color={colors.primary} />
                  <Text style={[msgStyles.pinnedText, { color: colors.primary }]}>Pinned</Text>
                </View>
              )}
              <View style={msgStyles.top}>
                <Text style={[msgStyles.sender, { color: colors.primary }]}>{msg.senderName}</Text>
                <Text style={[msgStyles.time, { color: colors.mutedForeground }]}>{format(new Date(msg.createdAt), "h:mm a")}</Text>
              </View>
              <Text style={[msgStyles.content, { color: colors.foreground }]}>{msg.content}</Text>
            </View>
          )}
        />
      )}
      <View style={[msgStyles.inputBar, { backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[msgStyles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
          placeholder="Message..." placeholderTextColor={colors.mutedForeground}
          value={text} onChangeText={setText} returnKeyType="send" onSubmitEditing={send} multiline
        />
        <TouchableOpacity
          style={[msgStyles.sendBtn, { backgroundColor: colors.primary }, (!text.trim() || isPending) && { opacity: 0.5 }]}
          onPress={send} disabled={!text.trim() || isPending}
        >
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const msgStyles = StyleSheet.create({
  bubble: { borderRadius: 14, padding: 14, gap: 4 },
  pinnedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  pinnedText: { fontSize: 11, fontWeight: "600" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sender: { fontSize: 13, fontWeight: "700" },
  time: { fontSize: 11 },
  content: { fontSize: 15, lineHeight: 21 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingTop: 10, paddingHorizontal: 16 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});

/* ─────── Files Tab translations ─────── */
const FILES_T: Record<string, Record<string, string>> = {
  en: { albums: "ALBUMS", documents: "DOCUMENTS", noFiles: "No files", noFilesYet: "No files uploaded yet", newAlbum: "New Album", uploadMedia: "Upload Media" },
  he: { albums: "אלבומים", documents: "מסמכים", noFiles: "אין קבצים", noFilesYet: "לא הועלו קבצים עדיין", newAlbum: "אלבום חדש", uploadMedia: "העלאת מדיה" },
  es: { albums: "ÁLBUMES", documents: "DOCUMENTOS", noFiles: "Sin archivos", noFilesYet: "Aún no hay archivos", newAlbum: "Nuevo Álbum", uploadMedia: "Subir Medios" },
};

/* ─────── Files Tab ─────── */
function FilesTab({ teamId, language }: { teamId: number; language?: string }) {
  const colors = useColors();
  const { data: albums, isLoading } = useListAlbums(teamId);
  const { data: docs } = useListTeamDocs(teamId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const t = FILES_T[language ?? "en"] ?? FILES_T.en;

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const albumList = albums ?? [];
  const docList = (docs ?? []) as any[];
  if (!albumList.length && !docList.length) return <EmptyState icon="folder" title={t.noFiles} subtitle={t.noFilesYet} />;

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>
        {albumList.length > 0 && (
          <>
            <Text style={[flStyles.sectionTitle, { color: colors.mutedForeground }]}>{t.albums}</Text>
            <View style={flStyles.albumGrid}>
              {albumList.map((album: any) => {
                const cover = album.coverUrl ?? album.files?.[0]?.url;
                return (
                  <TouchableOpacity key={album.id} style={[flStyles.albumCard, { backgroundColor: colors.card }]}
                    onPress={() => cover && setPreviewUrl(cover)} activeOpacity={0.85}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={flStyles.albumThumb} resizeMode="cover" />
                    ) : (
                      <View style={[flStyles.albumIcon, { backgroundColor: `${colors.primary}22` }]}>
                        <Feather name="image" size={24} color={colors.primary} />
                      </View>
                    )}
                    <Text style={[flStyles.albumName, { color: colors.foreground }]} numberOfLines={2}>{album.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        {docList.length > 0 && (
          <>
            <Text style={[flStyles.sectionTitle, { color: colors.mutedForeground }]}>{t.documents}</Text>
            {docList.map((doc: any, i: number) => (
              <TouchableOpacity key={doc.id ?? i}
                style={[flStyles.docRow, { backgroundColor: colors.card }]}
                onPress={() => {
                  const url = doc.url;
                  const isImage = doc.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(url ?? "");
                  if (isImage && url) { setPreviewUrl(url); }
                  else if (url) { Linking.openURL(url); }
                }}
                activeOpacity={0.8}
              >
                <View style={[flStyles.docIcon, { backgroundColor: doc.mimeType?.startsWith("image/") ? `${colors.primary}22` : `${colors.info}22` }]}>
                  <Feather name={doc.mimeType?.startsWith("image/") ? "image" : "file-text"} size={20} color={doc.mimeType?.startsWith("image/") ? colors.primary : colors.info} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[flStyles.docName, { color: colors.foreground }]} numberOfLines={1}>
                    {doc.originalName ?? doc.filename}
                  </Text>
                  {doc.size ? <Text style={[flStyles.docSize, { color: colors.mutedForeground }]}>{(doc.size / 1024).toFixed(1)} KB</Text> : null}
                </View>
                <Feather name={doc.mimeType?.startsWith("image/") ? "eye" : "download"} size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Full-screen image preview */}
      <Modal visible={!!previewUrl} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setPreviewUrl(null)}>
        <View style={[flStyles.previewRoot, { backgroundColor: "#000" }]}>
          <TouchableOpacity style={flStyles.previewClose} onPress={() => setPreviewUrl(null)} hitSlop={12}>
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
          {previewUrl && (
            <Image source={{ uri: previewUrl }} style={flStyles.previewImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </>
  );
}

const flStyles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  albumCard: { width: "47%", borderRadius: 14, overflow: "hidden" },
  albumThumb: { width: "100%", height: 100 },
  albumIcon: { width: "100%", height: 80, alignItems: "center", justifyContent: "center" },
  albumName: { fontSize: 13, fontWeight: "600", padding: 10 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, marginBottom: 6 },
  docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  docName: { fontSize: 14, fontWeight: "500" },
  docSize: { fontSize: 11, marginTop: 2 },
  previewRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  previewClose: { position: "absolute", top: 56, right: 20, zIndex: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, padding: 8 },
  previewImage: { width: "100%", height: "100%" },
});

/* ─────── Root Team Screen ─────── */
export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const teamId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("squad");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: team, isLoading } = useGetTeam(teamId);
  const { data: appUser } = useAppUser();
  const { data: roster } = useRoster(teamId);

  const isCoach = appUser?.role !== "player";

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={[styles.teamName, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]} numberOfLines={1}>{team?.name}</Text>
          <Text style={[styles.teamMeta, { color: colors.mutedForeground }]}>{team?.sport}{team?.season ? ` · ${team.season}` : ""}</Text>
        </View>
        <View style={[styles.teamAvatar, { backgroundColor: team?.avatarColor ?? colors.primary }]}>
          <Text style={[styles.teamAvatarText, { fontFamily: "BebasNeue_400Regular" }]}>{team?.name?.[0]?.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabBar, { borderBottomColor: colors.border }]}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
            activeOpacity={0.8}
          >
            <Feather name={tab.icon as any} size={15} color={activeTab === tab.key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {activeTab === "squad"     && <SquadTab teamId={teamId} isCoach={isCoach} />}
        {activeTab === "next-game" && <NextGameTab teamId={teamId} />}
        {activeTab === "schedule"  && <ScheduleTab teamId={teamId} />}
        {activeTab === "tasks"     && <TasksTab teamId={teamId} isCoach={isCoach} roster={roster ?? []} />}
        {activeTab === "messages"  && <MessagesTab teamId={teamId} />}
        {activeTab === "files"     && <FilesTab teamId={teamId} language={appUser?.language} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  titleBlock: { flex: 1 },
  teamName: { fontSize: 22 },
  teamMeta: { fontSize: 13, marginTop: 2 },
  teamAvatar: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  teamAvatarText: { color: "#fff", fontSize: 22 },
  tabBar: { paddingHorizontal: 8, gap: 2, height: 48, alignItems: "flex-end", borderBottomWidth: 1 },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 12 },
  tabLabel: { fontSize: 12, fontWeight: "600" },
});
