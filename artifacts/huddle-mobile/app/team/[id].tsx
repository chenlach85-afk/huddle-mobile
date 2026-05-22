import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { format } from "date-fns";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
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
} from "@workspace/api-client-react";
import { useRoster } from "@/lib/useApi";
import { StatusBadge } from "@/components/StatusBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { EmptyState } from "@/components/EmptyState";

type Tab = "squad" | "schedule" | "tasks" | "messages" | "files";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "squad", label: "Squad", icon: "users" },
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

function SquadTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: roster, isLoading } = useRoster(teamId);
  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const members = roster ?? [];
  if (!members.length) return <EmptyState icon="users" title="No players" subtitle="Add players from the web app" />;
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => String(m.id)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      scrollEnabled={!!members.length}
      renderItem={({ item: member }) => (
        <View style={[squadStyles.card, { backgroundColor: colors.card }]}>
          <View style={[squadStyles.jersey, { backgroundColor: `${colors.primary}22` }]}>
            <Text style={[squadStyles.jerseyNum, { color: colors.primary }]}>
              {member.jerseyNumber ?? "#"}
            </Text>
          </View>
          <View style={squadStyles.info}>
            <Text style={[squadStyles.name, { color: colors.foreground }]}>
              {member.placeholderFullName ?? "Player"}
            </Text>
            {member.position ? (
              <Text style={[squadStyles.pos, { color: colors.mutedForeground }]}>{member.position}</Text>
            ) : null}
          </View>
          <View style={squadStyles.right}>
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
  );
}
const squadStyles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14 },
  jersey: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  jerseyNum: { fontSize: 18, fontWeight: "800" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  pos: { fontSize: 12, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
});

function ScheduleTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: events, isLoading } = useListEvents(teamId);
  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const now = Date.now();
  const upcoming = (events ?? [])
    .filter((e) => new Date(e.startsAt).getTime() > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  if (!upcoming.length) return <EmptyState icon="calendar" title="No upcoming events" />;
  return (
    <FlatList
      data={upcoming}
      keyExtractor={(e) => String(e.id)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      scrollEnabled={!!upcoming.length}
      renderItem={({ item: event }) => (
        <View style={[schedStyles.card, { backgroundColor: colors.card }]}>
          <View style={[schedStyles.accent, { backgroundColor: EVENT_COLORS[event.type] ?? colors.primary }]} />
          <View style={schedStyles.body}>
            <View style={schedStyles.top}>
              <View style={[schedStyles.pill, { backgroundColor: `${EVENT_COLORS[event.type] ?? colors.primary}22` }]}>
                <Text style={[schedStyles.pillText, { color: EVENT_COLORS[event.type] ?? colors.primary }]}>
                  {EVENT_LABELS[event.type] ?? "Event"}
                </Text>
              </View>
              <Text style={[schedStyles.date, { color: colors.mutedForeground }]}>
                {format(new Date(event.startsAt), "MMM d · h:mm a")}
              </Text>
            </View>
            <Text style={[schedStyles.title, { color: colors.foreground }]}>{event.title}</Text>
            {event.location ? (
              <View style={schedStyles.loc}>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={[schedStyles.locText, { color: colors.mutedForeground }]}>{event.location}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}
    />
  );
}
const schedStyles = StyleSheet.create({
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

function TasksTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: tasks, isLoading, refetch } = useListTasks(teamId);
  const { mutate: updateTask } = useUpdateTask();
  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const list = tasks ?? [];
  if (!list.length) return <EmptyState icon="check-square" title="No tasks" subtitle="No tasks assigned yet" />;
  return (
    <FlatList
      data={list}
      keyExtractor={(t) => String(t.id)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      scrollEnabled={!!list.length}
      renderItem={({ item: task }) => (
        <View style={[taskStyles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[taskStyles.check, task.status === "done" && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => {
              updateTask({ taskId: task.id, data: { status: task.status === "done" ? "pending" : ("done" as "done") } }, {
                onSuccess: () => { Haptics.selectionAsync(); refetch(); },
              });
            }}
            hitSlop={8}
          >
            {task.status === "done" && <Feather name="check" size={12} color="#fff" />}
          </TouchableOpacity>
          <View style={taskStyles.info}>
            <Text style={[taskStyles.title, { color: colors.foreground, textDecorationLine: task.status === "done" ? "line-through" : "none" }]}>
              {task.title}
            </Text>
            {task.dueDate ? (
              <Text style={[taskStyles.due, { color: colors.mutedForeground }]}>Due {task.dueDate}</Text>
            ) : null}
          </View>
          <StatusBadge status={(task.priority as any) ?? "medium"} small />
        </View>
      )}
    />
  );
}
const taskStyles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: "#7a8399", alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "500" },
  due: { fontSize: 12, marginTop: 2 },
});

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
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
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
                <Text style={[msgStyles.time, { color: colors.mutedForeground }]}>
                  {format(new Date(msg.createdAt), "h:mm a")}
                </Text>
              </View>
              <Text style={[msgStyles.content, { color: colors.foreground }]}>{msg.content}</Text>
            </View>
          )}
        />
      )}
      <View style={[msgStyles.inputBar, { backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[msgStyles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          returnKeyType="send"
          onSubmitEditing={send}
          multiline
        />
        <TouchableOpacity
          style={[msgStyles.sendBtn, { backgroundColor: colors.primary }, (!text.trim() || isPending) && { opacity: 0.5 }]}
          onPress={send}
          disabled={!text.trim() || isPending}
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

function FilesTab({ teamId }: { teamId: number }) {
  const colors = useColors();
  const { data: albums, isLoading } = useListAlbums(teamId);
  const { data: docs } = useListTeamDocs(teamId);
  if (isLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  const albumList = albums ?? [];
  const docList = docs ?? [];
  if (!albumList.length && !docList.length) return <EmptyState icon="folder" title="No files" subtitle="No files uploaded yet" />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {albumList.length > 0 && (
        <View>
          <Text style={[filesStyles.sectionTitle, { color: colors.mutedForeground }]}>ALBUMS</Text>
          <View style={filesStyles.albumGrid}>
            {albumList.map((album) => (
              <View key={album.id} style={[filesStyles.albumCard, { backgroundColor: colors.card }]}>
                <View style={[filesStyles.albumIcon, { backgroundColor: `${colors.primary}22` }]}>
                  <Feather name="image" size={24} color={colors.primary} />
                </View>
                <Text style={[filesStyles.albumName, { color: colors.foreground }]} numberOfLines={2}>{album.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {docList.length > 0 && (
        <View>
          <Text style={[filesStyles.sectionTitle, { color: colors.mutedForeground }]}>DOCUMENTS</Text>
          {docList.map((doc) => (
            <TouchableOpacity key={(doc as any).id} style={[filesStyles.docRow, { backgroundColor: colors.card }]}
              onPress={() => (doc as any).url && Linking.openURL((doc as any).url)} activeOpacity={0.8}>
              <View style={[filesStyles.docIcon, { backgroundColor: `${colors.info}22` }]}>
                <Feather name="file-text" size={20} color={colors.info} />
              </View>
              <Text style={[filesStyles.docName, { color: colors.foreground }]} numberOfLines={1}>
                {(doc as any).originalName ?? (doc as any).filename}
              </Text>
              <Feather name="external-link" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}
const filesStyles = StyleSheet.create({
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },
  albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  albumCard: { width: "47%", borderRadius: 14, padding: 16, alignItems: "center", gap: 10 },
  albumIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  albumName: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, marginBottom: 8 },
  docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  docName: { flex: 1, fontSize: 14, fontWeight: "500" },
});

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
          <Text style={[styles.teamName, { color: colors.foreground }]} numberOfLines={1}>{team?.name}</Text>
          <Text style={[styles.teamMeta, { color: colors.mutedForeground }]}>{team?.sport}{team?.season ? ` · ${team.season}` : ""}</Text>
        </View>
        <View style={[styles.teamAvatar, { backgroundColor: team?.avatarColor ?? colors.primary }]}>
          <Text style={styles.teamAvatarText}>{team?.name?.[0]?.toUpperCase()}</Text>
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
            <Feather name={tab.icon as any} size={16} color={activeTab === tab.key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        {activeTab === "squad" && <SquadTab teamId={teamId} />}
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
  teamName: { fontSize: 20, fontWeight: "800" },
  teamMeta: { fontSize: 13, marginTop: 2 },
  teamAvatar: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  teamAvatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  tabBar: { paddingHorizontal: 16, gap: 4, height: 48, alignItems: "flex-end" },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontWeight: "600" },
});
