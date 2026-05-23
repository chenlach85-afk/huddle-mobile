import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { apiFetch } from "@/lib/useApi";

const SPORTS = ["Football", "Basketball", "Baseball", "Soccer", "Volleyball", "Tennis", "Rugby", "Hockey", "Other"];

async function uploadImageBase64(
  uri: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? null);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function CreateTeamModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [sport, setSport] = useState("Football");
  const [season, setSeason] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const { mutate: createTeam, isPending } = useCreateTeam();
  const { refetch } = useListTeams();

  const pickImage = async (source: "library" | "camera") => {
    const pick =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
    if (!pick.canceled && pick.assets[0]) {
      setImageUri(pick.assets[0].uri);
    }
  };

  const showImageOptions = () => {
    Alert.alert("Team Photo", "Choose a source", [
      { text: "Camera", onPress: () => pickImage("camera") },
      { text: "Photo Library", onPress: () => pickImage("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const submit = async () => {
    if (!name.trim()) return;

    let imageUrl: string | undefined;
    if (imageUri) {
      setImageUploading(true);
      try {
        const mime = "image/jpeg";
        const b64 = await uploadImageBase64(imageUri, mime);
        if (b64) {
          const result = await apiFetch<{ url: string }>("/api/files/upload", {
            method: "POST",
            body: JSON.stringify({ filename: "team-avatar.jpg", mimeType: mime, size: b64.length, data: b64 }),
          });
          imageUrl = result.url;
        }
      } catch {
        /* non-fatal — create team without image */
      } finally {
        setImageUploading(false);
      }
    }

    createTeam(
      { data: { name: name.trim(), sport, season: season.trim() || undefined, coachName: "Coach", imageUrl } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refetch();
          setName(""); setSport("Football"); setSeason(""); setImageUri(null);
          onClose();
        },
        onError: () => Alert.alert("Error", "Failed to create team"),
      },
    );
  };

  const s = modalStyles(colors);
  const busy = isPending || imageUploading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.foreground }]}>New Team</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Team Photo Picker */}
        <TouchableOpacity style={s.avatarWrap} onPress={showImageOptions} activeOpacity={0.8}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatarPlaceholder, { backgroundColor: colors.muted }]}>
              <Feather name="camera" size={28} color={colors.mutedForeground} />
            </View>
          )}
          <View style={[s.avatarBadge, { backgroundColor: colors.primary }]}>
            <Feather name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={[s.avatarHint, { color: colors.mutedForeground }]}>Tap to add a team photo</Text>

        <TextInput
          style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Team name"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
        />
        <Text style={[s.label, { color: colors.mutedForeground }]}>Sport</Text>
        <View style={s.chips}>
          {SPORTS.map((sp) => (
            <TouchableOpacity
              key={sp}
              style={[s.chip, { backgroundColor: sport === sp ? colors.primary : colors.muted }]}
              onPress={() => setSport(sp)}
            >
              <Text style={[s.chipText, { color: sport === sp ? "#fff" : colors.mutedForeground }]}>{sp}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Season (optional)"
          placeholderTextColor={colors.mutedForeground}
          value={season}
          onChangeText={setSeason}
        />
        <TouchableOpacity
          style={[s.btn, { backgroundColor: colors.primary }, busy && { opacity: 0.7 }]}
          onPress={submit}
          disabled={busy || !name.trim()}
          activeOpacity={0.85}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Team</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const modalStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: { flex: 1, padding: 24 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    title: { fontSize: 22, fontWeight: "700" },
    avatarWrap: { alignSelf: "center", marginBottom: 8 },
    avatarImg: { width: 88, height: 88, borderRadius: 44 },
    avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
    avatarBadge: {
      position: "absolute", bottom: 2, right: 2, width: 26, height: 26,
      borderRadius: 13, alignItems: "center", justifyContent: "center",
    },
    avatarHint: { textAlign: "center", fontSize: 12, marginBottom: 16 },
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
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.85}
        >
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
              {team.imageUrl ? (
                <Image source={{ uri: team.imageUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: team.avatarColor ?? colors.primary }]}>
                  <Text style={styles.avatarText}>{team.name[0]?.toUpperCase()}</Text>
                </View>
              )}
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
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "800" },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, padding: 16 },
  avatar: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 52, height: 52, borderRadius: 14 },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 22 },
  info: { flex: 1 },
  teamName: { fontSize: 17, fontWeight: "700" },
  meta: { fontSize: 13, marginTop: 2 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  loc: { fontSize: 12 },
});
