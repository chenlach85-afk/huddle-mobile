import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useListTeams, useCreateTeam } from "@workspace/api-client-react";
import { EmptyState } from "@/components/EmptyState";

const SPORTS = ["Football", "Basketball", "Baseball", "Soccer", "Volleyball", "Tennis", "Rugby", "Hockey", "Other"];

function CreateTeamModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [sport, setSport] = useState("Football");
  const [season, setSeason] = useState("");
  const { mutate: createTeam, isPending } = useCreateTeam();
  const { refetch } = useListTeams();

  const submit = () => {
    if (!name.trim()) return;
    createTeam(
      { data: { name: name.trim(), sport, season: season.trim() || undefined, coachName: "Coach" } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refetch();
          setName(""); setSport("Football"); setSeason("");
          onClose();
        },
        onError: () => Alert.alert("Error", "Failed to create team"),
      }
    );
  };

  const s = modalStyles(colors);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.foreground }]}>New Team</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <TextInput style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Team name" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
        <Text style={[s.label, { color: colors.mutedForeground }]}>Sport</Text>
        <View style={s.chips}>
          {SPORTS.map((sp) => (
            <TouchableOpacity key={sp} style={[s.chip, { backgroundColor: sport === sp ? colors.primary : colors.muted }]}
              onPress={() => setSport(sp)}>
              <Text style={[s.chipText, { color: sport === sp ? "#fff" : colors.mutedForeground }]}>{sp}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Season (optional)" placeholderTextColor={colors.mutedForeground} value={season} onChangeText={setSeason} />
        <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }, isPending && { opacity: 0.7 }]}
          onPress={submit} disabled={isPending || !name.trim()} activeOpacity={0.85}>
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Team</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const modalStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  root: { flex: 1, padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 10, marginTop: 4 },
  input: { height: 52, borderRadius: 12, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: "600" },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default function TeamsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: teams, isLoading, refetch } = useListTeams();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Teams</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={teams ?? []}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
          refreshing={isLoading}
          onRefresh={refetch}
          scrollEnabled={!!(teams?.length)}
          ListEmptyComponent={
            <EmptyState icon="users" title="No teams yet" subtitle="Tap + to create your first team" />
          }
          renderItem={({ item: team }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => router.push(`/team/${team.id}`)}
              activeOpacity={0.8}
            >
              <View style={[styles.avatar, { backgroundColor: team.avatarColor ?? colors.primary }]}>
                <Text style={styles.avatarText}>{team.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {team.sport}{team.season ? ` · ${team.season}` : ""}
                </Text>
                {team.location ? (
                  <View style={styles.locRow}>
                    <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.loc, { color: colors.mutedForeground }]}>{team.location}</Text>
                  </View>
                ) : null}
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        />
      )}
      <CreateTeamModal visible={showCreate} onClose={() => setShowCreate(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800" },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, padding: 16 },
  avatar: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 22 },
  info: { flex: 1 },
  teamName: { fontSize: 17, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: 2 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  loc: { fontSize: 12 },
});
