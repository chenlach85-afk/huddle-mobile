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
  Linking,
  Modal,
  Platform,
  ScrollView,
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
import { useRoster, useCreateRosterMember } from "@/lib/useApi";
import { StatusBadge } from "@/components/StatusBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { EmptyState } from "@/components/EmptyState";
import type { Event } from "@workspace/api-client-react";

type Tab = "squad" | "next-game" | "schedule" | "tasks" | "messages" | "files";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "squad", label: "Squad", icon: "users" },
  { key: "next-game", label: "Next Game", icon: "shield" },
  { key: "schedule", label: "Schedule", icon: "calendar" },
  { key: "tasks", label: "Tasks", icon: "check-square" },
  { key: "messages", label: "Messages", icon: "message-circle" },
  { key: "files", label: "Files", icon: "folder" },
];

const EVENT_COLORS: Record<string, string> = {
  training: "#4a90e2", league_game: "#ff6b1a", friendly_game: "#f7b538",
  tournament: "#e74c3c", celebration: "#2ecc71", meeting: "#9b59b6", other: "#7a8399",
};
const EVENT_LABELS: Record<string, string> = {
  training: "Training", league_game: "League", friendly_game: "Friendly",
  tournament: "Tournament", celebration: "Celebration", meeting: "Meeting", other: "Other",
};
const GAME_TYPES = ["league_game", "friendly_game", "tournament"];
const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;

/* ─────── Add Player Modal ─────── */
function AddPlayerModal({ teamId, visible, onClose }: { teamId: number; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const { mutate, isPending } = useCreateRosterMember(teamId);

  const submit = () => {
    if (!name.trim()) return;
    mutate({ placeholderFullName: name.trim(), jerseyNumber: jersey || undefined, position: position || undefined, placeholderEmail: email || undefined, placeholderPhone: phone || undefined }, {
      onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setName(""); setJersey(""); setPosition(""); setEmail(""); setPhone(""); onClose(); },
      onError: () => Alert.alert("Error", "Could not add player"),
    });
  };

  const inp = (v: string, set: (s: string) => void, ph: string, kb?: "number-pad" | "email-address" | "phone-pad") => (
    <TextInput style={[mStyles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
      placeholder={ph} placeholderTextColor={colors.mutedForeground} value={v} onChangeText={set}
      keyboardType={kb} autoCapitalize="none" />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[mStyles.root, { backgroundColor: colors.background }]}>
        <View style={mStyles.header}>
          <Text style={[mStyles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>Add Player</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        {inp(name, setName, "Full name *")}
        {inp(jersey, setJersey, "Jersey number", "number-pad")}
        {inp(position, setPosition, "Position (e.g. Forward)")}
        {inp(email, setEmail, "Email (optional)", "email-address")}
        {inp(phone, setPhone, "Phone / WhatsApp (optional)", "phone-pad")}
        <TouchableOpacity style={[mStyles.btn, { backgroundColor: colors.primary }, (isPending || !name.trim()) && { opacity: 0.6 }]}
          onPress={submit} disabled={isPending || !name.trim()} activeOpacity={0.85}>
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.btnText}>Add Player</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/* ─────── Add Task Modal ─────── */
function AddTaskModal({ teamId, visible, onClose }: { teamId: number; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<typeof PRIORITY_OPTIONS[number]>("medium");
  const [dueDate, setDueDate] = useState("");
  const { mutate, isPending } = useCreateTask();

  const submit = () => {
    if (!title.trim()) return;
    mutate({ teamId, data: { title: title.trim(), priority, dueDate: dueDate || undefined } }, {
      onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTitle(""); setPriority("medium"); setDueDate(""); onClose(); },
      onError: () => Alert.alert("Error", "Could not create task"),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[mStyles.root, { backgroundColor: colors.background }]}>
        <View style={mStyles.header}>
          <Text style={[mStyles.title, { color: colors.foreground, fontFamily: "Oswald_700Bold" }]}>New Task</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        <TextInput style={[mStyles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Task title *" placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
        <Text style={[mStyles.label, { color: colors.mutedForeground }]}>Priority</Text>
        <View style={mStyles.chips}>
          {PRIORITY_OPTIONS.map((p) => (
            <TouchableOpacity key={p} style={[mStyles.chip, { backgroundColor: priority === p ? colors.primary : colors.muted }]} onPress={() => setPriority(p)}>
              <Text style={[mStyles.chipText, { color: priority === p ? "#fff" : colors.mutedForeground }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[mStyles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Due date (YYYY-MM-DD)" placeholderTextColor={colors.mutedForeground} value={dueDate} onChangeText={setDueDate} />
        <TouchableOpacity style={[mStyles.btn, { backgroundColor: colors.primary }, (isPending || !title.trim()) && { opacity: 0.6 }]}
          onPress={submit} disabled={isPending || !title.trim()} activeOpacity={0.85}>
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.btnText}>Create Task</Text>}
        </TouchableOpacity>
      </View>
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
function EventDetailModal({ event, visible, onClose }: { event: Event | null; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  if (!event) return null;
  const { data: attendance, refetch } = useListAttendance(event.id);
  const { mutate: upsertAtt } = useUpsertAttendance();

  const RSVP_OPTIONS = [
    { status: "attending" as const, label: "Going", color: "#2ecc71", icon: "check-circle" },
    { status: "maybe" as const, label: "Maybe", color: "#f7b538", icon: "help-circle" },
    { status: "not_attending" as const, label: "Can't Go", color: "#ef3b3b", icon: "x-circle" },
  ];

  const counts = {
    attending: (attendance ?? []).filter((a) => a.status === "attending").length,
    maybe: (attendance ?? []).filter((a) => a.status === "maybe").length,
    not_attending: (attendance ?? []).filter((a) => a.status === "not_attending").length,
  };

  const accentColor = EVENT_COLORS[event.type] ?? colors.primary;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[evStyles.root, { backgroundColor: colors.background }]}>
        <View style={evStyles.header}>
          <View style={[evStyles.typePill, { backgroundColor: `${accentColor}22` }]}>
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

        <Text style={[evStyles.sectionTitle, { color: colors.mutedForeground }]}>ATTENDANCE</Text>
        <View style={evStyles.countRow}>
          <View style={[evStyles.countCard, { backgroundColor: "rgba(46,204,113,0.12)" }]}>
            <Text style={[evStyles.countNum, { color: "#2ecc71" }]}>{counts.attending}</Text>
            <Text style={[evStyles.countLabel, { color: "#2ecc71" }]}>Going</Text>
          </View>
          <View style={[evStyles.countCard, { backgroundColor: "rgba(247,181,56,0.12)" }]}>
            <Text style={[evStyles.countNum, { color: "#f7b538" }]}>{counts.maybe}</Text>
            <Text style={[evStyles.countLabel, { color: "#f7b538" }]}>Maybe</Text>
          </View>
          <View style={[evStyles.countCard, { backgroundColor: "rgba(239,59,59,0.12)" }]}>
            <Text style={[evStyles.countNum, { color: "#ef3b3b" }]}>{counts.not_attending}</Text>
            <Text style={[evStyles.countLabel, { color: "#ef3b3b" }]}>Can't Go</Text>
          </View>
        </View>

      </View>
    </Modal>
  );
}

const evStyles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  typePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
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
});

/* ─────── Squad Tab ─────── */
function SquadTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: roster, isLoading, refetch } = useRoster(teamId);
  const [showAdd, setShowAdd] = useState(false);

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
        ListEmptyComponent={<EmptyState icon="users" title="No players yet" subtitle="Tap + to add your first player" />}
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
            </View>
          </View>
        )}
      />
      <TouchableOpacity style={[sqStyles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
        <Feather name="user-plus" size={22} color="#fff" />
      </TouchableOpacity>
      <AddPlayerModal teamId={teamId} visible={showAdd} onClose={() => setShowAdd(false)} />
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

const ATT_STATUS_CYCLE = ["attending", "maybe", "not_attending", "no_response"] as const;
type AttStatus = typeof ATT_STATUS_CYCLE[number];
const ATT_CONFIG: Record<AttStatus, { color: string; icon: string; label: string }> = {
  attending:     { color: "#2ecc71", icon: "check-circle", label: "Going" },
  maybe:         { color: "#f7b538", icon: "help-circle",  label: "Maybe" },
  not_attending: { color: "#ef3b3b", icon: "x-circle",     label: "Can't Go" },
  no_response:   { color: "#7a8399", icon: "clock",        label: "No Reply" },
};

function NextGameDetail({ event, roster, accentColor }: { event: Event; roster: any[]; accentColor: string }) {
  const colors = useColors();
  const { data: attendance, refetch } = useListAttendance(event.id);
  const { mutate: upsertAtt } = useUpsertAttendance();

  const att = attendance ?? [];

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

  const confirmed    = att.filter((a) => a.status === "attending").length;
  const maybe        = att.filter((a) => a.status === "maybe").length;
  const cantMake     = att.filter((a) => a.status === "not_attending").length;
  const noResponseCount = roster.filter((m) => !att.find((a) => a.playerId === m.id)).length;
  const noResponseRoster = roster.filter((m) => !att.find((a) => a.playerId === m.id));
  const whatsappNumbers  = noResponseRoster.flatMap((m) =>
    m.placeholderPhone ? [m.placeholderPhone.replace(/\D/g, "")] : []
  );

  const sendWhatsapp = () => {
    if (whatsappNumbers.length === 0) {
      Alert.alert("No contacts", "No phone numbers for non-responders");
      return;
    }
    const msg = encodeURIComponent(
      `Reminder: "${event.title}" on ${format(new Date(event.startsAt), "MMM d")} at ${format(new Date(event.startsAt), "h:mm a")}. Please let us know if you're coming!`
    );
    Linking.openURL(`https://wa.me/${whatsappNumbers[0]}?text=${msg}`);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>
      <View style={[ngStyles.heroCard, { backgroundColor: colors.card, borderLeftColor: accentColor }]}>
        <View style={ngStyles.heroTop}>
          <View style={[ngStyles.typePill, { backgroundColor: `${accentColor}22` }]}>
            <Feather name="shield" size={12} color={accentColor} />
            <Text style={[ngStyles.typePillText, { color: accentColor }]}>{EVENT_LABELS[event.type]}</Text>
          </View>
          <Text style={[ngStyles.dateText, { color: colors.mutedForeground }]}>
            {format(new Date(event.startsAt), "EEEE, MMM d")}
          </Text>
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
          { count: confirmed,       label: "Confirmed",    color: "#2ecc71",            icon: "check-circle" },
          { count: maybe,           label: "Maybe",        color: "#f7b538",            icon: "help-circle"  },
          { count: cantMake,        label: "Can't Make It",color: "#ef3b3b",            icon: "x-circle"     },
          { count: noResponseCount, label: "No Response",  color: colors.mutedForeground, icon: "clock"      },
        ].map(({ count, label, color, icon }) => (
          <View key={label} style={[ngStyles.attCard, { backgroundColor: colors.card }]}>
            <Feather name={icon as any} size={20} color={color} />
            <Text style={[ngStyles.attNum, { color }]}>{count}</Text>
            <Text style={[ngStyles.attLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={[ngStyles.sectionTitle, { color: colors.mutedForeground }]}>PLAYER RSVP — tap to cycle</Text>
      {roster.map((member) => {
        const status = getPlayerStatus(member.id);
        const cfg = ATT_CONFIG[status];
        return (
          <TouchableOpacity
            key={member.id}
            style={[ngStyles.playerRsvpRow, { backgroundColor: colors.card }]}
            onPress={() => cycleStatus(member.id)}
            activeOpacity={0.75}
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

      {noResponseRoster.length > 0 && (
        <TouchableOpacity
          style={[ngStyles.whatsappBtn, { backgroundColor: "#2ecc7118", borderColor: "#2ecc7144", borderWidth: 1 }]}
          onPress={sendWhatsapp}
          activeOpacity={0.8}
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
  heroCard:        { borderRadius: 18, padding: 20, gap: 8, borderLeftWidth: 4 },
  heroTop:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typePill:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  typePillText:    { fontSize: 12, fontWeight: "700" },
  dateText:        { fontSize: 13 },
  eventTitle:      { fontSize: 26, lineHeight: 30 },
  locRow:          { flexDirection: "row", alignItems: "center", gap: 5 },
  locText:         { fontSize: 13 },
  countdownLabel:  { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  sectionTitle:    { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  attGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  attCard:         { width: "47%", borderRadius: 14, padding: 16, alignItems: "center", gap: 6 },
  attNum:          { fontSize: 28, fontWeight: "800" },
  attLabel:        { fontSize: 12, fontWeight: "500", textAlign: "center" },
  playerRsvpRow:   { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 12 },
  miniJersey:      { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  miniJerseyNum:   { fontSize: 16, fontWeight: "700" },
  playerName:      { flex: 1, fontSize: 14, fontWeight: "500" },
  statusChip:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusChipText:  { fontSize: 12, fontWeight: "600" },
  whatsappBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14 },
  whatsappText:    { fontSize: 14, fontWeight: "700" },
});

/* ─────── Schedule Tab ─────── */
function ScheduleTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: events, isLoading } = useListEvents(teamId);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const now = Date.now();
  const upcoming = (events ?? [])
    .filter((e) => new Date(e.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  if (!upcoming.length) return <EmptyState icon="calendar" title="No upcoming events" />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={upcoming}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        scrollEnabled
        renderItem={({ item: event }) => (
          <TouchableOpacity style={[schStyles.card, { backgroundColor: colors.card }]} onPress={() => setSelectedEvent(event)} activeOpacity={0.85}>
            <View style={[schStyles.accent, { backgroundColor: EVENT_COLORS[event.type] ?? colors.primary }]} />
            <View style={schStyles.body}>
              <View style={schStyles.top}>
                <View style={[schStyles.pill, { backgroundColor: `${EVENT_COLORS[event.type] ?? colors.primary}22` }]}>
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
      />
      <EventDetailModal event={selectedEvent} visible={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
    </View>
  );
}

const schStyles = StyleSheet.create({
  card: { flexDirection: "row", borderRadius: 14, overflow: "hidden" },
  accent: { width: 4 },
  body: { flex: 1, padding: 14, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: "700" },
  date: { fontSize: 12 },
  title: { fontSize: 15, fontWeight: "600" },
  loc: { flexDirection: "row", alignItems: "center", gap: 4 },
  locText: { fontSize: 12 },
});

/* ─────── Tasks Tab ─────── */
function TasksTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: tasks, isLoading, refetch } = useListTasks(teamId);
  const { mutate: updateTask } = useUpdateTask();
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const list = tasks ?? [];

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        keyExtractor={(t) => String(t.id)}
        onRefresh={refetch}
        refreshing={isLoading}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        scrollEnabled
        ListEmptyComponent={<EmptyState icon="check-square" title="No tasks" subtitle="Tap + to create a task" />}
        renderItem={({ item: task }) => (
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
              {task.dueDate ? <Text style={[tkStyles.due, { color: colors.mutedForeground }]}>Due {task.dueDate}</Text> : null}
            </View>
            <StatusBadge status={(task.priority as any) ?? "medium"} small />
          </View>
        )}
      />
      <TouchableOpacity style={[sqStyles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
        <Feather name="plus" size={22} color="#fff" />
      </TouchableOpacity>
      <AddTaskModal teamId={teamId} visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const tkStyles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: "#7a8399", alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "500" },
  due: { fontSize: 12, marginTop: 2 },
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
        <TouchableOpacity style={[msgStyles.sendBtn, { backgroundColor: colors.primary }, (!text.trim() || isPending) && { opacity: 0.5 }]}
          onPress={send} disabled={!text.trim() || isPending}>
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

/* ─────── Files Tab ─────── */
function FilesTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: albums, isLoading } = useListAlbums(teamId);
  const { data: docs } = useListTeamDocs(teamId);
  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const albumList = albums ?? [];
  const docList = (docs ?? []) as any[];
  if (!albumList.length && !docList.length) return <EmptyState icon="folder" title="No files" subtitle="No files uploaded yet" />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100 }}>
      {albumList.length > 0 && (
        <>
          <Text style={[flStyles.sectionTitle, { color: colors.mutedForeground }]}>ALBUMS</Text>
          <View style={flStyles.albumGrid}>
            {albumList.map((album) => (
              <View key={album.id} style={[flStyles.albumCard, { backgroundColor: colors.card }]}>
                <View style={[flStyles.albumIcon, { backgroundColor: `${colors.primary}22` }]}>
                  <Feather name="image" size={24} color={colors.primary} />
                </View>
                <Text style={[flStyles.albumName, { color: colors.foreground }]} numberOfLines={2}>{album.name}</Text>
                <Text style={[flStyles.albumSub, { color: colors.mutedForeground }]}>Tap to view</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {docList.length > 0 && (
        <>
          <Text style={[flStyles.sectionTitle, { color: colors.mutedForeground }]}>DOCUMENTS</Text>
          {docList.map((doc, i) => (
            <TouchableOpacity key={doc.id ?? i} style={[flStyles.docRow, { backgroundColor: colors.card }]}
              onPress={() => doc.url && Linking.openURL(doc.url)} activeOpacity={0.8}>
              <View style={[flStyles.docIcon, { backgroundColor: `${colors.info}22` }]}>
                <Feather name="file-text" size={20} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[flStyles.docName, { color: colors.foreground }]} numberOfLines={1}>
                  {doc.originalName ?? doc.filename}
                </Text>
                {doc.size ? <Text style={[flStyles.docSize, { color: colors.mutedForeground }]}>{(doc.size / 1024).toFixed(1)} KB</Text> : null}
              </View>
              <Feather name="download" size={16} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const flStyles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  albumCard: { width: "47%", borderRadius: 14, padding: 16, alignItems: "center", gap: 8 },
  albumIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  albumName: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  albumSub: { fontSize: 11 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, marginBottom: 6 },
  docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  docName: { fontSize: 14, fontWeight: "500" },
  docSize: { fontSize: 11, marginTop: 2 },
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
        horizontal
        showsHorizontalScrollIndicator={false}
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
        {activeTab === "squad" && <SquadTab teamId={teamId} />}
        {activeTab === "next-game" && <NextGameTab teamId={teamId} />}
        {activeTab === "schedule" && <ScheduleTab teamId={teamId} />}
        {activeTab === "tasks" && <TasksTab teamId={teamId} />}
        {activeTab === "messages" && <MessagesTab teamId={teamId} />}
        {activeTab === "files" && <FilesTab teamId={teamId} />}
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
